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
import { formatDateTime, formatMoney, formatUnits } from "@/utils/format";
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
}: {
  label: string;
  value: string;
  sub: ReactNode;
  icon: ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="label-xs">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "num mt-3 text-2xl font-semibold tracking-tight",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
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
    return latest ? formatDateTime(latest.updated_at) : "—";
  }, [expenses]);
  const inventoryValue = useMemo(
    () => inventory.reduce((t, i) => t + i.estimated_value, 0),
    [inventory],
  );

  const profitPositive = metrics.net_profit >= 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {settings.user_name || "Shopkeeper"}
          </h1>
          <p className="num mt-1 text-xs text-muted-foreground">
            Logged in: {settings.user_name || "—"} · Device: {settings.device_id}
          </p>
        </div>
      </header>

      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Eye className="size-4 shrink-0" aria-hidden />
          <span>Viewer Mode: Connected to Google Sheet with read-only access. You can view all records, analytics and pull sheet data.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Remaining stock"
          value={`${formatUnits(metrics.total_stock_units)} Units`}
          sub={`${metrics.unique_models_in_stock} models in stock`}
          icon={<Boxes className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Net profit"
          value={formatMoney(metrics.net_profit, currency)}
          tone={profitPositive ? "positive" : "negative"}
          sub={
            <span className="inline-flex items-center gap-1">
              {profitPositive ? (
                <TrendingUp className="size-3.5 text-success" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5 text-destructive" aria-hidden />
              )}
              Gross: {formatMoney(metrics.gross_profit, currency)}
            </span>
          }
          icon={<TrendingUp className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Total sales"
          value={formatMoney(metrics.total_sales_revenue, currency)}
          sub={`Invested: ${formatMoney(metrics.total_investment, currency)}`}
          icon={<Tag className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Expenses"
          value={formatMoney(metrics.total_expenses, currency)}
          sub={`Last updated: ${lastExpenseAt}`}
          icon={<Wallet className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/buy" className={btnPrimary}>
          {isReadOnly ? <ShoppingCart className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {isReadOnly ? "Purchases" : "Buy"}
        </Link>
        <Link to="/sell" className={btnOutline}>
          {isReadOnly ? <Tag className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {isReadOnly ? "Sales" : "Sell"}
        </Link>
        <Link to="/expenses" className={btnOutline}>
          {isReadOnly ? <Receipt className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {isReadOnly ? "Expenses" : "Expense"}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-3">
          <SectionTitle
            right={
              <span className="num text-sm text-muted-foreground">
                Value {formatMoney(inventoryValue, currency)}
              </span>
            }
          >
            Inventory watchlist
          </SectionTitle>
          {lowStock.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Stock levels look healthy"
              description="Items running low or out of stock will be flagged here."
            />
          ) : (
            <ul className="space-y-2">
              {lowStock.map((item) => (
                <li
                  key={item.model}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.model}</p>
                    <p className="num text-xs text-muted-foreground">
                      {formatUnits(item.remaining)} units left
                    </p>
                  </div>
                  <StatusPill tone={item.remaining <= 0 ? "destructive" : "warning"}>
                    <AlertTriangle className="size-3" aria-hidden />
                    {item.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="space-y-3">
          <SectionTitle>Recent transactions</SectionTitle>
          {recentSales.length === 0 && recentPurchases.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No transactions yet"
              description="Record a purchase or a sale and it will show up here."
            />
          ) : (
            <ul className="space-y-2">
              {recentSales.map((s) => (
                <li
                  key={s.record_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="text-success">Sold</span> {s.model}
                    </p>
                    <p className="num text-xs text-muted-foreground">
                      {formatUnits(s.quantity)} units · {s.record_id}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold text-success">
                    +{formatMoney(s.total_sale, currency)}
                  </span>
                </li>
              ))}
              {recentPurchases.map((p) => (
                <li
                  key={p.record_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="text-info">Bought</span> {p.model}
                    </p>
                    <p className="num text-xs text-muted-foreground">
                      {formatUnits(p.quantity)} units · {p.record_id}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold">
                    -{formatMoney(p.total_cost, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="space-y-3">
        <SectionTitle
          right={
            <Link to="/activity" className="text-sm font-medium text-primary">
              View all
            </Link>
          }
        >
          Recent activity
        </SectionTitle>
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activity yet"
            description="Every add, edit and delete is recorded here for your records."
          />
        ) : (
          <ul className="divide-y divide-border">
            {recentActivity.map((log) => (
              <li key={log.change_id} className="flex flex-wrap gap-x-3 gap-y-1 py-2.5">
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{log.user}</span>{" "}
                  <span className="label-xs">
                    ({log.action} {log.section})
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {log.model} / {log.record_id}
                  </span>
                </p>
                <p className="num text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                {log.remarks ? (
                  <p className="w-full truncate text-xs text-muted-foreground">{log.remarks}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Receipt className="size-3.5" aria-hidden /> All figures are calculated live from your
        stored purchases, sales, adjustments and expenses.
      </p>
    </div>
  );
}
