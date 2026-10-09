import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  SectionTitle,
  btnOutline,
  btnPrimary,
  inputClass,
} from "@/components/common/ui-bits";
import {
  buildInventory,
  computeMetrics,
  inRange,
  weightedAverageCosts,
} from "@/services/calculations";
import { useCurrency, useStockStore } from "@/store/stockStore";
import { formatMoney } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Stockly" },
      {
        name: "description",
        content: "Profit, revenue, cost of goods and expense reports for any date range.",
      },
      { property: "og:title", content: "Reports — Stockly" },
      { property: "og:description", content: "Financial reports built from your own records." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const expenses = useStockStore((s) => s.expenses);
  const adjustments = useStockStore((s) => s.adjustments);
  const threshold = useStockStore((s) => s.settings.low_stock_threshold);
  const currency = useCurrency();

  const [draft, setDraft] = useState({ start: "", end: "" });
  const [range, setRange] = useState({ start: "", end: "" });

  const data = useMemo(() => {
    const f = <T extends { date: string }>(rows: T[]) =>
      !range.start && !range.end
        ? rows
        : rows.filter((r) => inRange(r.date, range.start, range.end));
    return {
      purchases: f(purchases),
      sales: f(sales),
      expenses: f(expenses),
      adjustments: f(adjustments),
    };
  }, [purchases, sales, expenses, adjustments, range]);

  // COGS always uses the weighted average cost across the whole purchase history.
  const avg = useMemo(() => weightedAverageCosts(purchases), [purchases]);
  const cogs = useMemo(
    () => data.sales.reduce((t, s) => t + s.quantity * (avg[s.model] ?? 0), 0),
    [data.sales, avg],
  );
  const metrics = useMemo(() => {
    const base = computeMetrics(data, buildInventory(data, threshold));
    const gross = base.total_sales_revenue - cogs;
    return { ...base, gross_profit: gross, net_profit: gross - base.total_expenses };
  }, [data, threshold, cogs]);

  const transactionCount =
    data.purchases.length + data.sales.length + data.expenses.length + data.adjustments.length;

  const series = useMemo(() => {
    const map = new Map<
      string,
      { date: string; sales: number; purchases: number; expenses: number; profit: number }
    >();
    const touch = (date: string) => {
      const key = (date || "").slice(0, 10);
      if (!key) return null;
      if (!map.has(key))
        map.set(key, { date: key, sales: 0, purchases: 0, expenses: 0, profit: 0 });
      return map.get(key)!;
    };
    for (const s of data.sales) {
      const row = touch(s.date);
      if (!row) continue;
      row.sales += s.total_sale;
      row.profit += s.total_sale - s.quantity * (avg[s.model] ?? 0);
    }
    for (const p of data.purchases) {
      const row = touch(p.date);
      if (row) row.purchases += p.total_cost;
    }
    for (const e of data.expenses) {
      const row = touch(e.date);
      if (!row) continue;
      row.expenses += e.amount;
      row.profit -= e.amount;
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, avg]);

  const kpis = [
    { label: "Net profit", value: metrics.net_profit, tone: true },
    { label: "Gross profit", value: metrics.gross_profit, tone: true },
    { label: "Sales revenue", value: metrics.total_sales_revenue },
    { label: "Cost of goods sold", value: cogs },
    { label: "Operational expenses", value: metrics.total_expenses },
  ];

  const chartAxis = {
    stroke: "var(--color-muted-foreground)",
    fontSize: 11,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Financial performance for any period." />

      <Panel>
        <SectionTitle>Date range</SectionTitle>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setRange(draft);
          }}
        >
          <Field label="Start date" htmlFor="rep-start">
            <input
              id="rep-start"
              type="date"
              className={inputClass}
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
            />
          </Field>
          <Field label="End date" htmlFor="rep-end">
            <input
              id="rep-end"
              type="date"
              className={inputClass}
              value={draft.end}
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
            />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              Apply
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={() => {
                setDraft({ start: "", end: "" });
                setRange({ start: "", end: "" });
              }}
            >
              All time
            </button>
          </div>
        </form>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="surface p-4">
            <p className="label-xs">{k.label}</p>
            <p
              className={cn(
                "num mt-2 text-xl font-semibold",
                k.tone && (k.value >= 0 ? "text-success" : "text-destructive"),
              )}
            >
              {formatMoney(k.value, currency)}
            </p>
          </div>
        ))}
        <div className="surface p-4">
          <p className="label-xs">Transactions</p>
          <p className="num mt-2 text-xl font-semibold">{transactionCount}</p>
        </div>
      </div>

      {series.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="Nothing to report yet"
            description="Record purchases, sales or expenses and your charts will build automatically."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel className="space-y-3">
            <SectionTitle>Profit over time</SectionTitle>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={64} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="var(--color-chart-1)"
                    fill="url(#profitFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="space-y-3">
            <SectionTitle>Sales vs purchases vs expenses</SectionTitle>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={64} />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.3 }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="sales"
                    name="Sales"
                    fill="var(--color-chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="purchases"
                    name="Purchases"
                    fill="var(--color-chart-2)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="var(--color-chart-3)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
