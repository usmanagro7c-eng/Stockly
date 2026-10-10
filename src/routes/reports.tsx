import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Download,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useCurrency, useInventory, useStockStore } from "@/store/stockStore";
import {
  exportStockInventoryExcel,
  exportSalesReportExcel,
  exportExpensesReportExcel,
  exportCompleteBusinessWorkbook,
  printSalesReportPDF,
} from "@/services/export-reports";
import { formatDate, formatMoney, todayISO } from "@/utils/format";
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
  const investments = useStockStore((s) => s.investments);
  const inventory = useInventory();
  const shopName = useStockStore((s) => s.settings.user_name);
  const threshold = useStockStore((s) => s.settings.low_stock_threshold);
  const currency = useCurrency();

  const [draft, setDraft] = useState({ start: "", end: "" });
  const [range, setRange] = useState({ start: "", end: "" });
  const [preset, setPreset] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH">("ALL");

  const setRangePreset = (p: "ALL" | "TODAY" | "WEEK" | "MONTH") => {
    setPreset(p);
    const today = new Date();
    const todayStr = todayISO();

    if (p === "ALL") {
      setDraft({ start: "", end: "" });
      setRange({ start: "", end: "" });
    } else if (p === "TODAY") {
      setDraft({ start: todayStr, end: todayStr });
      setRange({ start: todayStr, end: todayStr });
    } else if (p === "WEEK") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      const startStr = d.toISOString().slice(0, 10);
      setDraft({ start: startStr, end: todayStr });
      setRange({ start: startStr, end: todayStr });
    } else if (p === "MONTH") {
      const startStr = `${todayStr.slice(0, 7)}-01`;
      setDraft({ start: startStr, end: todayStr });
      setRange({ start: startStr, end: todayStr });
    }
  };

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

  const profitPositive = metrics.net_profit >= 0;

  const kpis = [
    {
      label: "Net Profit",
      value: metrics.net_profit,
      tone: true,
      color: profitPositive ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive",
      sub: "After COGS & expenses",
    },
    {
      label: "Gross Profit",
      value: metrics.gross_profit,
      tone: true,
      color: "border-border/80 bg-elevated/60 text-foreground",
      sub: "Revenue minus stock costs",
    },
    {
      label: "Sales Revenue",
      value: metrics.total_sales_revenue,
      color: "border-blue-500/30 bg-blue-500/5 text-blue-400",
      sub: `${data.sales.length} sale transactions`,
    },
    {
      label: "Cost of Goods Sold (COGS)",
      value: cogs,
      color: "border-border/80 bg-elevated/60 text-foreground",
      sub: "Weighted average stock cost",
    },
    {
      label: "Operating Expenses",
      value: metrics.total_expenses,
      color: "border-amber-500/30 bg-amber-500/5 text-amber-400",
      sub: `${data.expenses.length} expense entries`,
    },
    {
      label: "Total Purchases",
      value: data.purchases.reduce((t, p) => t + p.total_cost, 0),
      color: "border-purple-500/30 bg-purple-500/5 text-purple-400",
      sub: `${data.purchases.length} supplier orders`,
    },
  ];

  const chartAxis = {
    stroke: "var(--color-muted-foreground)",
    fontSize: 11,
  };

  const rangeLabel =
    range.start && range.end
      ? `${formatDate(range.start)} — ${formatDate(range.end)}`
      : preset === "TODAY"
      ? "Today"
      : preset === "WEEK"
      ? "Last 7 Days"
      : preset === "MONTH"
      ? "This Month"
      : "All Recorded Time";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        subtitle="Live income statement, revenue analysis, and profit trends."
      />

      {/* 📊 Export Reports Toolbar */}
      <Panel className="bg-gradient-to-br from-card/95 to-elevated/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SectionTitle left={<Download className="size-4 text-emerald-400" />}>
              1-Click Export &amp; Download Reports
            </SectionTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Period: <span className="font-semibold text-foreground">{rangeLabel}</span> • Download formatted Excel (.xlsx) sheets or print/save A4 PDF
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            {/* Sales Excel */}
            <button
              type="button"
              className={cn(btnPrimary, "tap-active text-xs sm:text-sm")}
              onClick={() => {
                exportSalesReportExcel(data.sales, currency, rangeLabel);
                toast.success("Sales Excel report downloaded!");
              }}
            >
              <FileSpreadsheet className="size-4" /> Sales (Excel)
            </button>

            {/* Print / PDF */}
            <button
              type="button"
              className={cn(btnOutline, "tap-active text-xs sm:text-sm")}
              onClick={() => {
                printSalesReportPDF({
                  shopName,
                  userName: shopName,
                  dateRange: rangeLabel,
                  currency,
                  metrics: {
                    totalSales: metrics.total_sales_revenue,
                    totalProfit: metrics.gross_profit,
                    totalExpenses: metrics.total_expenses,
                    netProfit: metrics.net_profit,
                    itemsSold: data.sales.reduce((t, s) => t + s.quantity, 0),
                  },
                  sales: data.sales,
                });
              }}
            >
              <Printer className="size-4" /> Print / Save PDF
            </button>

            {/* Stock Inventory Excel */}
            <button
              type="button"
              className={cn(btnOutline, "tap-active text-xs sm:text-sm")}
              onClick={() => {
                exportStockInventoryExcel(inventory, currency, threshold);
                toast.success("Stock Inventory Excel downloaded!");
              }}
            >
              <Download className="size-4" /> Stock (Excel)
            </button>

            {/* Expenses Excel */}
            <button
              type="button"
              className={cn(btnOutline, "tap-active text-xs sm:text-sm")}
              onClick={() => {
                exportExpensesReportExcel(data.expenses, currency, rangeLabel);
                toast.success("Expenses Excel sheet downloaded!");
              }}
            >
              <Download className="size-4" /> Expenses (Excel)
            </button>

            {/* Master Business Workbook */}
            <button
              type="button"
              className={cn(btnOutline, "col-span-2 sm:col-span-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 tap-active text-xs sm:text-sm")}
              onClick={() => {
                exportCompleteBusinessWorkbook(
                  { inventory, sales: data.sales, purchases: data.purchases, expenses: data.expenses, investments },
                  currency,
                );
                toast.success("Master Business Workbook (.xlsx) downloaded!");
              }}
            >
              <FileSpreadsheet className="size-4" /> Master Workbook
            </button>
          </div>
        </div>
      </Panel>

      {/* Date Range & Quick Presets Panel */}
      <Panel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle left={<Calendar className="size-4" />}>Report Date Filter</SectionTitle>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setRangePreset("ALL")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                preset === "ALL"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setRangePreset("TODAY")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                preset === "TODAY"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setRangePreset("WEEK")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                preset === "WEEK"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setRangePreset("MONTH")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                preset === "MONTH"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Custom date range form */}
        <form
          className="grid gap-3 sm:grid-cols-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPreset("ALL");
            setRange(draft);
          }}
        >
          <Field label="Custom Start Date" htmlFor="rep-start">
            <input
              id="rep-start"
              type="date"
              className={inputClass}
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
            />
          </Field>
          <Field label="Custom End Date" htmlFor="rep-end">
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
              Apply Filter
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={() => setRangePreset("ALL")}
            >
              Reset
            </button>
          </div>
        </form>
      </Panel>

      {/* KPI Financial Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={cn(
              "rounded-2xl border p-4.5 transition-all shadow-xs",
              k.color,
            )}
          >
            <p className="label-xs text-muted-foreground font-semibold">{k.label}</p>
            <p className="num mt-2 text-2xl font-bold tracking-tight">
              {formatMoney(k.value, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      {series.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="No financial records in selected period"
            description="Adjust the date filter or record transactions to generate live financial charts."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Profit Over Time Chart */}
          <Panel className="space-y-3.5">
            <SectionTitle>Net Profit Trend</SectionTitle>
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                  <XAxis dataKey="date" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={64} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 16,
                      fontSize: 12,
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="var(--color-chart-1)"
                    fill="url(#profitFill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Sales vs Purchases vs Expenses */}
          <Panel className="space-y-3.5">
            <SectionTitle>Revenue, Inventory Cost & Expenses</SectionTitle>
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                  <XAxis dataKey="date" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={64} />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.2 }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 16,
                      fontSize: 12,
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="sales"
                    name="Sales"
                    fill="var(--color-chart-1)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="purchases"
                    name="Purchases"
                    fill="var(--color-chart-2)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="var(--color-chart-3)"
                    radius={[6, 6, 0, 0]}
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
