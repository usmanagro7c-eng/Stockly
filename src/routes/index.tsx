import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Boxes,
  Eye,
  Plus,
  Receipt,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  EmptyState,
  Panel,
  SectionTitle,
  StatusPill,
  btnOutline,
  btnPrimary,
} from "@/components/common/ui-bits";
import { useCurrency, useInventory, useIsReadOnly, useMetrics, useStockStore } from "@/store/stockStore";
import { formatDate, formatDateTime, formatMoney, formatUnits } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stockly" },
      {
        name: "description",
        content:
          "Live view of your stock, sales, expenses and net profit, calculated from your own records.",
      },
      { property: "og:title", content: "Dashboard — Stockly" },
      {
        property: "og:description",
        content: "Live stock, sales, expenses and profit for your shop.",
      },
    ],
  }),
  component: Dashboard,
});

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
  accentColor,
}: {
  label: string;
  value: string;
  sub: ReactNode;
  icon: ReactNode;
  tone?: "default" | "positive" | "negative";
  accentColor?: string;
}) {
  return (
    <div
      className={cn(
        "surface relative overflow-hidden p-4.5 sm:p-5 transition-all duration-200 hover:border-border hover:shadow-md",
        tone === "positive" && "border-success/30 bg-gradient-to-br from-card to-success/5",
        tone === "negative" && "border-destructive/30 bg-gradient-to-br from-card to-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label-xs text-muted-foreground font-semibold">{label}</p>
        <span
          className={cn(
            "flex size-9.5 items-center justify-center rounded-xl ring-1 shadow-xs transition-transform",
            accentColor || "bg-elevated text-muted-foreground ring-border/80",
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "num mt-3 text-2xl font-bold tracking-tight sm:text-3xl",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">{sub}</div>
    </div>
  );
}

function Dashboard() {
  const metrics = useMetrics();
  const inventory = useInventory();
  const currency = useCurrency();
  const isReadOnly = useIsReadOnly();
  const settings = useStockStore((s) => s.settings);
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const expenses = useStockStore((s) => s.expenses);
  const changelogs = useStockStore((s) => s.changelogs);
  const sheetRole = useStockStore((s) => s.sheetRole);

  const recentSales = useMemo(
    () => [...sales].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4),
    [sales],
  );
  const recentPurchases = useMemo(
    () => [...purchases].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4),
    [purchases],
  );
  const lowStock = useMemo(
    () =>
      inventory.filter((i) => i.status === "LOW STOCK" || i.status === "OUT OF STOCK").slice(0, 5),
    [inventory],
  );
  const recentActivity = useMemo(
    () => [...changelogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5),
    [changelogs],
  );
  const lastExpenseAt = useMemo(() => {
    const latest = [...expenses].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    return latest ? formatDate(latest.date) : "—";
  }, [expenses]);
  const inventoryValue = useMemo(
    () => inventory.reduce((t, i) => t + i.estimated_value, 0),
    [inventory],
  );

  const profitPositive = metrics.net_profit >= 0;

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero Welcome Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {todayFormatted}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">Store: {settings.user_name || "Stockly"}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {settings.user_name || "Shopkeeper"}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live overview of sales, stock value, and net earnings.
          </p>
        </div>

        {/* Status pill on the right */}
        <div className="flex items-center gap-2">
          {settings.linked_file_name ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Google Sheet Synced</span>
            </div>
          ) : (
            <Link
              to="/settings"
              className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-elevated/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Offline Database</span>
              <ChevronRight className="size-3.5" />
            </Link>
          )}
        </div>
      </header>

      {isReadOnly && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-medium text-amber-400">
          <Eye className="size-4.5 shrink-0" aria-hidden />
          <span>
            Viewer Mode: Connected to Google Sheet with read-only permissions. You can inspect all data and pull fresh updates.
          </span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Net Profit */}
        <KpiCard
          label="Net profit"
          value={formatMoney(metrics.net_profit, currency)}
          tone={profitPositive ? "positive" : "negative"}
          accentColor={profitPositive ? "bg-success/15 text-success ring-success/30" : "bg-destructive/15 text-destructive ring-destructive/30"}
          sub={
            <span className="inline-flex items-center gap-1 font-medium">
              {profitPositive ? (
                <TrendingUp className="size-3.5 text-success" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5 text-destructive" aria-hidden />
              )}
              <span>Gross: {formatMoney(metrics.gross_profit, currency)}</span>
            </span>
          }
          icon={profitPositive ? <TrendingUp className="size-4.5" /> : <TrendingDown className="size-4.5" />}
        />

        {/* Total Sales */}
        <KpiCard
          label="Total sales revenue"
          value={formatMoney(metrics.total_sales_revenue, currency)}
          accentColor="bg-blue-500/15 text-blue-400 ring-blue-500/30"
          sub={`Total investment: ${formatMoney(metrics.total_investment, currency)}`}
          icon={<Tag className="size-4.5" aria-hidden />}
        />

        {/* Remaining Stock */}
        <KpiCard
          label="Remaining stock"
          value={`${formatUnits(metrics.total_stock_units)} Units`}
          accentColor="bg-purple-500/15 text-purple-400 ring-purple-500/30"
          sub={`Value: ${formatMoney(inventoryValue, currency)} (${metrics.unique_models_in_stock} models)`}
          icon={<Boxes className="size-4.5" aria-hidden />}
        />

        {/* Total Expenses */}
        <KpiCard
          label="Total expenses"
          value={formatMoney(metrics.total_expenses, currency)}
          accentColor="bg-amber-500/15 text-amber-400 ring-amber-500/30"
          sub={`Last recorded: ${lastExpenseAt}`}
          icon={<Wallet className="size-4.5" aria-hidden />}
        />
      </div>

      {/* Quick Action Touch Bar (Instant POS & Stock Entry for Mobile & Web) */}
      <div className="space-y-2">
        <p className="label-xs text-muted-foreground/80">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Link
            to="/sell"
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-left transition-all hover:bg-emerald-500/20 active:scale-98 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
              <Tag className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Record Sale</p>
              <p className="text-[11px] text-muted-foreground truncate">Sell stock & calc profit</p>
            </div>
          </Link>

          <Link
            to="/buy"
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-left transition-all hover:bg-sky-500/20 active:scale-98 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 group-hover:scale-105 transition-transform">
              <ShoppingCart className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Buy Stock</p>
              <p className="text-[11px] text-muted-foreground truncate">Add incoming inventory</p>
            </div>
          </Link>

          <Link
            to="/expenses"
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-left transition-all hover:bg-amber-500/20 active:scale-98 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
              <Receipt className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Add Expense</p>
              <p className="text-[11px] text-muted-foreground truncate">Shop bills & costs</p>
            </div>
          </Link>

          <Link
            to="/stock"
            className="group flex min-h-14 items-center gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-left transition-all hover:bg-purple-500/20 active:scale-98 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-105 transition-transform">
              <Boxes className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Inventory</p>
              <p className="text-[11px] text-muted-foreground truncate">View stock levels</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Middle Dual Section: Inventory Watchlist & Recent Transactions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Inventory Watchlist */}
        <Panel className="space-y-3.5">
          <SectionTitle
            right={
              <Link to="/stock" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                View all ({inventory.length})
                <ChevronRight className="size-3.5" />
              </Link>
            }
          >
            Stock Watchlist
          </SectionTitle>

          {lowStock.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Stock levels are healthy"
              description="No low stock items. All inventory models have sufficient quantities."
            />
          ) : (
            <ul className="space-y-2.5">
              {lowStock.map((item) => (
                <li
                  key={item.model}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/60 p-3 transition-all hover:bg-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.model}</p>
                    <p className="num text-xs text-muted-foreground">
                      {formatUnits(item.remaining)} units remaining · Avg cost {formatMoney(item.avg_cost, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={item.remaining <= 0 ? "destructive" : "warning"}>
                      {item.status}
                    </StatusPill>
                    {!isReadOnly && (
                      <Link
                        to="/buy"
                        className="rounded-lg border border-border/80 bg-elevated px-2.5 py-1 text-xs font-semibold text-primary hover:bg-accent transition-colors"
                      >
                        Restock
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent Transactions */}
        <Panel className="space-y-3.5">
          <SectionTitle
            right={
              <Link to="/history" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                View history
                <ChevronRight className="size-3.5" />
              </Link>
            }
          >
            Recent Transactions
          </SectionTitle>

          {recentSales.length === 0 && recentPurchases.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No transactions yet"
              description="Record your first stock purchase or sale to see live activity."
            />
          ) : (
            <ul className="space-y-2.5">
              {recentSales.map((s) => (
                <li
                  key={s.record_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/60 p-3 transition-all hover:bg-elevated"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <ArrowUpRight className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        Sold <span className="font-bold">{s.model}</span>
                      </p>
                      <p className="num text-xs text-muted-foreground truncate">
                        {formatUnits(s.quantity)} units · {s.customer || "Walk-in customer"} · {formatDate(s.date)}
                      </p>
                    </div>
                  </div>
                  <span className="num text-sm font-bold text-success shrink-0">
                    +{formatMoney(s.total_sale, currency)}
                  </span>
                </li>
              ))}
              {recentPurchases.map((p) => (
                <li
                  key={p.record_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/60 p-3 transition-all hover:bg-elevated"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                      <ArrowDownLeft className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        Bought <span className="font-bold">{p.model}</span>
                      </p>
                      <p className="num text-xs text-muted-foreground truncate">
                        {formatUnits(p.quantity)} units · {p.supplier || "Supplier"} · {formatDate(p.date)}
                      </p>
                    </div>
                  </div>
                  <span className="num text-sm font-bold text-foreground/80 shrink-0">
                    -{formatMoney(p.total_cost, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recent Activity Log */}
      <Panel className="space-y-3.5">
        <SectionTitle
          right={
            <Link to="/activity" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Audit log
              <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          Recent Activity
        </SectionTitle>
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activity recorded"
            description="All modifications, additions and deletions will be audited here."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {recentActivity.map((log) => (
              <li key={log.change_id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-1 last:pb-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">{log.user || "User"}</span>{" "}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                      {log.action} {log.section}
                    </span>{" "}
                    <span className="text-xs text-muted-foreground font-mono">
                      {log.model ? `${log.model} · ` : ""}{log.record_id}
                    </span>
                  </p>
                  {log.remarks && (
                    <p className="mt-0.5 text-xs text-muted-foreground/80 truncate">{log.remarks}</p>
                  )}
                </div>
                <p className="num text-xs text-muted-foreground shrink-0">{formatDateTime(log.timestamp)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
