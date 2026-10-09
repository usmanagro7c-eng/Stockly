import type { Adjustment, DashboardMetrics, Expense, InventoryItem, Purchase, Sale } from "@/types";
import { safeDate } from "@/utils/format";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export interface DataSet {
  purchases: Purchase[];
  sales: Sale[];
  adjustments: Adjustment[];
  expenses: Expense[];
}

/** Weighted average buying cost per model: total purchase cost / total qty bought. */
export function weightedAverageCosts(purchases: Purchase[]): Record<string, number> {
  const cost: Record<string, number> = {};
  const qty: Record<string, number> = {};
  for (const p of purchases) {
    const model = p.model ?? "";
    if (!model) continue;
    cost[model] = (cost[model] ?? 0) + num(p.total_cost || num(p.quantity) * num(p.buying_price));
    qty[model] = (qty[model] ?? 0) + num(p.quantity);
  }
  const out: Record<string, number> = {};
  for (const model of Object.keys(qty)) {
    const q = qty[model] ?? 0;
    const c = cost[model] ?? 0;
    out[model] = q > 0 ? c / q : 0;
  }
  return out;
}

/**
 * Sorts a bucket oldest-first, deriving the order from `date` then
 * `created_at`.
 *
 * The sort keys are parsed once up front rather than inside the comparator:
 * comparing two rows re-parsed their dates on every single comparison, so the
 * parsing cost grew as O(rows log rows) instead of O(rows).
 */
function sortChronologically<T extends { date?: string; created_at?: string }>(rows: T[]): T[] {
  const decorated = rows.map((row) => ({
    row,
    dateMs: safeDate(row.date)?.getTime() ?? 0,
    createdMs: safeDate(row.created_at)?.getTime() ?? 0,
  }));
  decorated.sort((a, b) => a.dateMs - b.dateMs || a.createdMs - b.createdMs);
  return decorated.map((d) => d.row);
}

interface ModelBucket {
  purchases: Purchase[];
  sales: Sale[];
  adjustments: Adjustment[];
}

/**
 * Builds one inventory row per model.
 *
 * Rows are grouped into per-model buckets in a single pass and each bucket is
 * sorted once. The previous version re-scanned and re-copied every table for
 * every distinct model, which is O(models x rows) — on a phone with a few
 * thousand records that was enough to visibly stall the UI on each render.
 */
export function buildInventory(data: DataSet, lowStockThreshold: number): InventoryItem[] {
  const buckets = new Map<string, ModelBucket>();
  const bucket = (model: string): ModelBucket => {
    let b = buckets.get(model);
    if (!b) {
      b = { purchases: [], sales: [], adjustments: [] };
      buckets.set(model, b);
    }
    return b;
  };

  for (const p of data.purchases) {
    if (p.model) bucket(p.model).purchases.push(p);
  }
  for (const s of data.sales) {
    if (s.model) bucket(s.model).sales.push(s);
  }
  for (const a of data.adjustments) {
    if (a.model) bucket(a.model).adjustments.push(a);
  }

  const avg = weightedAverageCosts(data.purchases);
  const out: InventoryItem[] = [];

  for (const [model, b] of buckets) {
    const ps = sortChronologically(b.purchases);
    const ss = sortChronologically(b.sales);

    let bought = 0;
    let totalInvestment = 0;
    for (const p of ps) {
      bought += num(p.quantity);
      totalInvestment += num(p.total_cost || num(p.quantity) * num(p.buying_price));
    }

    let sold = 0;
    let totalSales = 0;
    for (const s of ss) {
      sold += num(s.quantity);
      totalSales += num(s.total_sale);
    }

    let adjusted = 0;
    for (const a of b.adjustments) adjusted += num(a.quantity);

    const remaining = bought - sold + adjusted;
    const avgCost = avg[model] ?? 0;

    const status: InventoryItem["status"] =
      remaining <= 0 ? "OUT OF STOCK" : remaining <= lowStockThreshold ? "LOW STOCK" : "IN STOCK";

    out.push({
      model,
      bought,
      sold,
      adjusted,
      remaining,
      avg_cost: avgCost,
      latest_buy_price: num(ps.at(-1)?.buying_price ?? 0),
      latest_sell_price: num(ss.at(-1)?.selling_price ?? 0),
      total_investment: totalInvestment,
      total_sales: totalSales,
      gross_profit: totalSales - sold * avgCost,
      estimated_value: Math.max(remaining, 0) * avgCost,
      status,
    });
  }

  return out.sort((a, b) => a.model.localeCompare(b.model));
}

export function computeMetrics(data: DataSet, inventory: InventoryItem[]): DashboardMetrics {
  const avg = weightedAverageCosts(data.purchases);
  const totalSalesRevenue = data.sales.reduce((t, s) => t + num(s.total_sale), 0);
  const cogs = data.sales.reduce((t, s) => t + num(s.quantity) * (avg[s.model] ?? 0), 0);
  const totalExpenses = data.expenses.reduce((t, e) => t + num(e.amount), 0);
  const grossProfit = totalSalesRevenue - cogs;
  const inStock = inventory.filter((i) => i.remaining > 0);

  return {
    total_stock_units: inStock.reduce((t, i) => t + i.remaining, 0),
    unique_models_in_stock: inStock.length,
    total_investment: data.purchases.reduce(
      (t, p) => t + num(p.total_cost || num(p.quantity) * num(p.buying_price)),
      0,
    ),
    total_sales_revenue: totalSalesRevenue,
    gross_profit: grossProfit,
    total_expenses: totalExpenses,
    net_profit: grossProfit - totalExpenses,
    low_stock_count: inventory.filter((i) => i.status === "LOW STOCK").length,
  };
}

export function costOfGoodsSold(data: DataSet): number {
  const avg = weightedAverageCosts(data.purchases);
  return data.sales.reduce((t, s) => t + num(s.quantity) * (avg[s.model] ?? 0), 0);
}

export function inRange(dateStr: string | undefined, start: string, end: string): boolean {
  const d = safeDate(dateStr);
  if (!d) return false;
  if (start) {
    const s = safeDate(start);
    if (s && d < s) return false;
  }
  if (end) {
    const e = safeDate(end);
    if (e) {
      const endOfDay = new Date(e);
      endOfDay.setHours(23, 59, 59, 999);
      if (d > endOfDay) return false;
    }
  }
  return true;
}
