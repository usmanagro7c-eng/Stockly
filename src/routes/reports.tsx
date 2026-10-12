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
  Share2,
  X,
  FileText,
  Check,
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
  const companyName = useStockStore((s) => s.settings.company_name);
  const userName = useStockStore((s) => s.settings.user_name);
  const shopName = companyName || userName;
  const threshold = useStockStore((s) => s.settings.low_stock_threshold);
  const currency = useCurrency();

  const [draft, setDraft] = useState({ start: "", end: "" });
  const [range, setRange] = useState({ start: "", end: "" });
  const [preset, setPreset] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH">("ALL");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const handleShareReport = async () => {
    const summaryText = `📊 *${shopName} — Financial Sales Report*\n` +
      `🗓 Period: ${rangeLabel}\n` +
      `💰 Total Sales: ${formatMoney(metrics.total_sales_revenue, currency)}\n` +
      `📈 Gross Profit: ${formatMoney(metrics.gross_profit, currency)}\n` +
      `🏷 Operating Expenses: ${formatMoney(metrics.total_expenses, currency)}\n` +
      `✅ Net Profit: ${formatMoney(metrics.net_profit, currency)}\n` +
      `📦 Items Sold: ${data.sales.reduce((t, s) => t + s.quantity, 0)} units\n\n` +
      `Generated via Stockly`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${shopName} Financial Report`,
          text: summaryText,
        });
        toast.success("Report shared successfully!");
        return;
      } catch {
        // User cancelled share
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(summaryText);
        toast.success("Report summary copied! You can paste in WhatsApp or message.");
        return;
      } catch {
        // Fallback
      }
    }
    toast.info("Report summary ready.");
  };

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
      <Panel className="bg-gradient-to-br from-card/95 to-elevated/70 border border-border/80">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <SectionTitle left={<Download className="size-4 text-emerald-400" />}>
                1-Click Export &amp; Download Reports
              </SectionTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Period: <span className="font-semibold text-foreground">{rangeLabel}</span> • Instant A4 PDF Document &amp; Excel sheets
              </p>
            </div>

            {/* Quick Share / Copy Button */}
            <button
              type="button"
              onClick={handleShareReport}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-border/70 bg-elevated/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all shadow-xs"
            >
              <Share2 className="size-3.5 text-primary" />
              <span>Share Summary</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
            {/* Primary Featured: Preview & Print PDF */}
            <button
              type="button"
              className={cn(
                btnPrimary,
                "col-span-2 sm:col-span-1 shadow-emerald-500/25 tap-active text-xs sm:text-sm font-bold flex items-center justify-center gap-2",
              )}
              onClick={() => setPdfPreviewOpen(true)}
            >
              <Printer className="size-4" />
              <span>Preview &amp; PDF</span>
            </button>

            {/* Sales Excel */}
            <button
              type="button"
              className={cn(btnOutline, "tap-active text-xs sm:text-sm flex items-center justify-center gap-2")}
              onClick={() => {
                exportSalesReportExcel(data.sales, currency, rangeLabel);
                toast.success("Sales Excel report downloaded!");
              }}
            >
              <FileSpreadsheet className="size-4 text-emerald-400" />
              <span>Sales (Excel)</span>
            </button>

            {/* Stock Inventory Excel */}
            <button
              type="button"
              className={cn(btnOutline, "tap-active text-xs sm:text-sm flex items-center justify-center gap-2")}
              onClick={() => {
                exportStockInventoryExcel(inventory, currency, threshold);
                toast.success("Stock Inventory Excel downloaded!");
              }}
            >
              <Download className="size-4 text-sky-400" />
              <span>Stock (Excel)</span>
            </button>

            {/* Expenses Excel */}
            <button
              type="button"
              className={cn(btnOutline, "tap-active text-xs sm:text-sm flex items-center justify-center gap-2")}
              onClick={() => {
                exportExpensesReportExcel(data.expenses, currency, rangeLabel);
                toast.success("Expenses Excel sheet downloaded!");
              }}
            >
              <Download className="size-4 text-amber-400" />
              <span>Expenses (Excel)</span>
            </button>

            {/* Master Business Workbook */}
            <button
              type="button"
              className={cn(
                btnOutline,
                "col-span-2 sm:col-span-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 tap-active text-xs sm:text-sm flex items-center justify-center gap-2",
              )}
              onClick={() => {
                exportCompleteBusinessWorkbook(
                  { inventory, sales: data.sales, purchases: data.purchases, expenses: data.expenses, investments },
                  currency,
                );
                toast.success("Master Business Workbook (.xlsx) downloaded!");
              }}
            >
              <FileSpreadsheet className="size-4" />
              <span>Master Workbook</span>
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
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1"
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
          <div className="col-span-2 flex items-end gap-2 pt-1 sm:pt-0">
            <button type="submit" className={cn(btnPrimary, "flex-1 tap-active")}>
              Apply Filter
            </button>
            <button
              type="button"
              className={cn(btnOutline, "flex-1 tap-active")}
              onClick={() => setRangePreset("ALL")}
            >
              Reset
            </button>
          </div>
        </form>
      </Panel>

      {/* KPI Financial Cards (Responsive 2x3 or 3x2 grid on mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={cn(
              "rounded-2xl border p-3.5 sm:p-4.5 transition-all shadow-xs flex flex-col justify-between",
              k.color,
            )}
          >
            <div>
              <p className="label-xs text-muted-foreground font-semibold truncate">{k.label}</p>
              <p className="num mt-1.5 text-lg sm:text-2xl font-bold tracking-tight truncate">
                {formatMoney(k.value, currency)}
              </p>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground truncate">{k.sub}</p>
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
            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                  <XAxis dataKey="date" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={50} />
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
            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                  <XAxis dataKey="date" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis tick={chartAxis} tickLine={false} axisLine={false} width={50} />
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

      {/* In-App Mobile PDF & Report Preview Dialog */}
      {pdfPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Modal Header */}
          <div className="pad-safe-top flex items-center justify-between border-b border-border/80 bg-surface/90 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FileText className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-tight">PDF Report Document</h2>
                <p className="text-[11px] text-muted-foreground">A4 Printable Layout • {rangeLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPdfPreviewOpen(false)}
              className="flex size-9 items-center justify-center rounded-xl border border-border/80 bg-elevated/70 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              aria-label="Close Preview"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Modal Scrollable Document Paper Body */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-white text-slate-900 p-4 sm:p-7 shadow-2xl space-y-4">
              {/* Document Brand Header */}
              <div className="border-b-2 border-emerald-600 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight">
                    {shopName || "Stockly Pro"}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Financial Sales &amp; Profit Statement</p>
                </div>
                <div className="text-left sm:text-right text-[11px] text-slate-500 space-y-0.5">
                  <div><span className="font-semibold text-slate-700">Period:</span> {rangeLabel}</div>
                  <div><span className="font-semibold text-slate-700">Generated:</span> {new Date().toLocaleDateString()}</div>
                  {userName && <div><span className="font-semibold text-slate-700">Prepared by:</span> {userName}</div>}
                </div>
              </div>

              {/* 4 Mini Document KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Revenue</p>
                  <p className="num text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                    {formatMoney(metrics.total_sales_revenue, currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Gross Profit</p>
                  <p className="num text-sm sm:text-base font-extrabold text-emerald-600 mt-0.5">
                    +{formatMoney(metrics.gross_profit, currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Expenses</p>
                  <p className="num text-sm sm:text-base font-extrabold text-rose-600 mt-0.5">
                    -{formatMoney(metrics.total_expenses, currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Net Profit</p>
                  <p className="num text-sm sm:text-base font-extrabold text-emerald-700 mt-0.5">
                    {formatMoney(metrics.net_profit, currency)}
                  </p>
                </div>
              </div>

              {/* Document Itemized Sales Table */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="uppercase tracking-wider text-[11px]">Itemized Sales ({data.sales.length} transactions)</span>
                  <span className="text-slate-500 font-medium">{data.sales.reduce((t, s) => t + s.quantity, 0)} units sold</span>
                </div>

                <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[500px] text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5">Product</th>
                        <th className="py-2 px-2.5 text-right">Qty</th>
                        <th className="py-2 px-2.5 text-right">Price</th>
                        <th className="py-2 px-2.5 text-right">Total</th>
                        <th className="py-2 px-2.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.sales.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No sales records recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        data.sales.map((s) => (
                          <tr key={s.record_id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-2.5 text-slate-500 whitespace-nowrap">{formatDate(s.date)}</td>
                            <td className="py-2 px-2.5 font-semibold text-slate-900">{s.model}</td>
                            <td className="py-2 px-2.5 text-right num text-slate-700">{s.quantity}</td>
                            <td className="py-2 px-2.5 text-right num text-slate-600">{formatMoney(s.selling_price, currency)}</td>
                            <td className="py-2 px-2.5 text-right num font-bold text-slate-900">{formatMoney(s.total_sale, currency)}</td>
                            <td className="py-2 px-2.5 text-right num font-semibold text-emerald-600">+{formatMoney(s.profit, currency)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {data.sales.length > 0 && (
                      <tfoot className="bg-slate-100/90 font-bold border-t border-slate-200 text-slate-900">
                        <tr>
                          <td colSpan={2} className="py-2 px-2.5">Total Sales</td>
                          <td className="py-2 px-2.5 text-right num">{data.sales.reduce((t, s) => t + s.quantity, 0)}</td>
                          <td className="py-2 px-2.5 text-right"></td>
                          <td className="py-2 px-2.5 text-right num font-extrabold">{formatMoney(metrics.total_sales_revenue, currency)}</td>
                          <td className="py-2 px-2.5 text-right num font-extrabold text-emerald-600">+{formatMoney(metrics.gross_profit, currency)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Document Footer */}
              <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>Stockly • Official Financial Record</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>

          {/* Modal Sticky Bottom Action Bar */}
          <div className="pad-safe-bottom border-t border-border/80 bg-surface/95 p-3 sm:px-6 shrink-0 flex items-center gap-2.5 justify-between">
            <button
              type="button"
              onClick={() => setPdfPreviewOpen(false)}
              className={cn(btnOutline, "flex-1 sm:flex-initial text-xs sm:text-sm tap-active")}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleShareReport}
              className={cn(btnOutline, "flex-1 sm:flex-initial text-xs sm:text-sm tap-active")}
            >
              <Share2 className="size-4" /> Share Summary
            </button>

            <button
              type="button"
              className={cn(btnPrimary, "flex-1 sm:flex-initial text-xs sm:text-sm tap-active shadow-emerald-500/30")}
              onClick={() => {
                printSalesReportPDF({
                  shopName,
                  userName,
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
          </div>
        </div>
      )}
    </div>
  );
}
