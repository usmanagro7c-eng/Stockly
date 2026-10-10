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
import { useMemo, useState, type ReactNode } from "react";
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

  const [activeTab, setActiveTab] = useState<"low" | "sales" | "purchases">("low");

  const recentSales = useMemo(
    () => [...sales].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [sales],
  );
  const recentPurchases = useMemo(
    () => [...purchases].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [purchases],
  );
  const lowStock = useMemo(
    () =>
      inventory.filter((i) => i.status === "LOW STOCK" || i.status === "OUT OF STOCK"),
    [inventory],
  );
  const recentActivity = useMemo(
    () => [...changelogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5),
    [changelogs],
  );
  const inventoryValue = useMemo(
    () => inventory.reduce((t, i) => t + i.estimated_value, 0),
    [inventory],
  );

  const profitPositive = metrics.net_profit >= 0;
  const profitMargin =
    metrics.total_sales_revenue > 0
      ? (metrics.net_profit / metrics.total_sales_revenue) * 100
      : 0;

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Welcome & Store Bar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-primary uppercase tracking-wider">{todayFormatted}</span>
            <span>·</span>
            <span className="truncate">{settings.user_name || "Stockly Retail"}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Business Overview
          </h1>
        </div>

        {/* Live Status Chip */}
        {settings.linked_file_name ? (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 shrink-0">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sheets Synced</span>
          </div>
        ) : (
          <Link
            to="/settings"
            className="flex items-center gap-1 rounded-full border border-border/70 bg-elevated/70 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
          >
            <span>Offline</span>
            <ChevronRight className="size-3" />
          </Link>
        )}
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-400">
          <Eye className="size-4 shrink-0" aria-hidden />
          <span>Viewer Mode: Read-only access to this Google Sheet.</span>
        </div>
      )}

      {/* 💳 Executive Fintech Hero Balance Card */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/12 via-card/95 to-card/75 p-5 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-emerald-400" />
            Net Shop Earnings
          </span>
          {metrics.total_sales_revenue > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold border",
                profitPositive
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-destructive/15 text-destructive border-destructive/30",
              )}
            >
              {profitPositive ? "+" : ""}{profitMargin.toFixed(1)}% margin
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span
            className={cn(
              "num text-3xl sm:text-4xl font-extrabold tracking-tight",
              profitPositive ? "text-foreground" : "text-destructive",
            )}
          >
            {formatMoney(metrics.net_profit, currency)}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            (Gross: {formatMoney(metrics.gross_profit, currency)})
          </span>
        </div>

        {/* 3 Inline Pillars */}
        <div className="mt-4.5 grid grid-cols-3 gap-2 border-t border-border/60 pt-3.5 text-left">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
            <p className="num mt-0.5 text-sm sm:text-base font-bold text-foreground">
              {formatMoney(metrics.total_sales_revenue, currency)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stock Value</p>
            <p className="num mt-0.5 text-sm sm:text-base font-bold text-foreground">
              {formatMoney(inventoryValue, currency)}
            </p>
            <p className="text-[10px] text-muted-foreground num">{formatUnits(metrics.total_stock_units)} units</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expenses</p>
            <p className="num mt-0.5 text-sm sm:text-base font-bold text-amber-400">
              {formatMoney(metrics.total_expenses, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* ⚡ Instant Operations Touchpads */}
      <div>
        <p className="label-xs text-muted-foreground/80 mb-2">Instant Operations</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Link
            to="/sell"
            className="group flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 transition-all hover:bg-emerald-500/20 active:scale-95 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <Tag className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Sell (POS)</p>
              <p className="text-[10px] text-muted-foreground truncate">Customer order</p>
            </div>
          </Link>

          <Link
            to="/buy"
            className="group flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 transition-all hover:bg-sky-500/20 active:scale-95 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-blue-400 text-white shadow-md shadow-sky-500/25 group-hover:scale-105 transition-transform">
              <ShoppingCart className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Stock Intake</p>
              <p className="text-[10px] text-muted-foreground truncate">Buy inventory</p>
            </div>
          </Link>

          <Link
            to="/expenses"
            className="group flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 transition-all hover:bg-amber-500/20 active:scale-95 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-md shadow-amber-500/25 group-hover:scale-105 transition-transform">
              <Receipt className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Expense</p>
              <p className="text-[10px] text-muted-foreground truncate">Bills & rent</p>
            </div>
          </Link>

          <Link
            to="/investments"
            className="group flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 transition-all hover:bg-indigo-500/20 active:scale-95 shadow-xs"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-400 text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Capital</p>
              <p className="text-[10px] text-muted-foreground truncate">Partners & loans</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 📊 Segmented Live Activities & Watchlist */}
      <Panel className="space-y-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-1 rounded-xl bg-elevated/70 p-1 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("low")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "low"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Low Stock {lowStock.length > 0 && `(${lowStock.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "sales"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Recent Sales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("purchases")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "purchases"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Purchases
            </button>
          </div>

          <Link
            to={activeTab === "low" ? "/stock" : "/history"}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 shrink-0"
          >
            <span>View All</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {/* Tab Content: Low Stock */}
        {activeTab === "low" && (
          <div>
            {lowStock.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="Stock is healthy"
                description="All inventory models have sufficient quantities above the threshold limit."
              />
            ) : (
              <ul className="space-y-2">
                {lowStock.slice(0, 5).map((item) => (
                  <li
                    key={item.model}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/50 p-2.5 transition-all hover:bg-elevated"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.model}</p>
                      <p className="num text-xs text-muted-foreground">
                        {formatUnits(item.remaining)} left · Avg cost {formatMoney(item.avg_cost, currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill tone={item.remaining <= 0 ? "destructive" : "warning"}>
                        {item.status}
                      </StatusPill>
                      {!isReadOnly && (
                        <Link
                          to="/buy"
                          className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 active:scale-95 transition-all"
                        >
                          Restock
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Tab Content: Recent Sales */}
        {activeTab === "sales" && (
          <div>
            {recentSales.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No sales yet"
                description="Make your first sale to start recording customer orders and profits."
              />
            ) : (
              <ul className="space-y-2">
                {recentSales.map((s) => (
                  <li
                    key={s.record_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/50 p-2.5 transition-all hover:bg-elevated"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                        <ArrowUpRight className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {s.model}
                        </p>
                        <p className="num text-[11px] text-muted-foreground truncate">
                          {formatUnits(s.quantity)} units · {s.customer || "Walk-in"} · {formatDate(s.date)}
                        </p>
                      </div>
                    </div>
                    <span className="num text-sm font-bold text-success shrink-0">
                      +{formatMoney(s.total_sale, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Tab Content: Purchases */}
        {activeTab === "purchases" && (
          <div>
            {recentPurchases.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No purchases yet"
                description="Record stock intake shipments to manage your inventory."
              />
            ) : (
              <ul className="space-y-2">
                {recentPurchases.map((p) => (
                  <li
                    key={p.record_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-elevated/50 p-2.5 transition-all hover:bg-elevated"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                        <ArrowDownLeft className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {p.model}
                        </p>
                        <p className="num text-[11px] text-muted-foreground truncate">
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
          </div>
        )}
      </Panel>

      {/* Audit Activity Card */}
      <Panel className="space-y-3">
        <SectionTitle
          right={
            <Link to="/activity" className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5">
              <span>View Log</span>
              <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          Activity Log
        </SectionTitle>

        {recentActivity.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activity recorded"
            description="System logs will appear here as records are modified."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {recentActivity.map((log) => (
              <li key={log.change_id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm truncate">
                    <span className="font-semibold text-foreground">{log.user || "User"}</span>{" "}
                    <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold">
                      {log.action} {log.section}
                    </span>{" "}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {log.model ? `${log.model}` : log.record_id}
                    </span>
                  </p>
                </div>
                <p className="num text-[11px] text-muted-foreground shrink-0">{formatDateTime(log.timestamp)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
