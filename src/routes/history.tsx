import { createFileRoute } from "@tanstack/react-router";
import { History as HistoryIcon, Tag, ShoppingCart, Receipt, SlidersHorizontal, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EmptyState,
  LoadMore,
  PageHeader,
  Panel,
  SearchField,
  StatusPill,
} from "@/components/common/ui-bits";
import { useListPaging } from "@/hooks/use-list-paging";
import { useDebounced } from "@/hooks/useDebounced";
import { useCurrency, useStockStore } from "@/store/stockStore";
import { formatDate, formatDateTime, formatMoney, formatUnits } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Stockly" },
      {
        name: "description",
        content:
          "One chronological timeline of every purchase, sale, expense and stock adjustment.",
      },
      { property: "og:title", content: "History — Stockly" },
      { property: "og:description", content: "Every transaction in one timeline." },
    ],
  }),
  component: HistoryPage,
});

type Kind = "PURCHASE" | "SALE" | "EXPENSE" | "ADJUSTMENT";
const KINDS: (Kind | "ALL")[] = ["ALL", "SALE", "PURCHASE", "EXPENSE", "ADJUSTMENT"];

function HistoryPage() {
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const expenses = useStockStore((s) => s.expenses);
  const adjustments = useStockStore((s) => s.adjustments);
  const currency = useCurrency();

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | "ALL">("ALL");
  const debounced = useDebounced(search, 300);

  const rows = useMemo(() => {
    const all = [
      ...purchases.map((p) => ({
        id: p.record_id,
        kind: "PURCHASE" as Kind,
        date: p.date,
        at: p.created_at,
        title: p.model,
        note: p.supplier || p.remarks,
        qty: p.quantity,
        amount: -p.total_cost,
        profit: null as number | null,
      })),
      ...sales.map((s) => ({
        id: s.record_id,
        kind: "SALE" as Kind,
        date: s.date,
        at: s.created_at,
        title: s.model,
        note: s.customer || s.remarks,
        qty: s.quantity,
        amount: s.total_sale,
        profit: s.profit,
      })),
      ...expenses.map((e) => ({
        id: e.record_id,
        kind: "EXPENSE" as Kind,
        date: e.date,
        at: e.created_at,
        title: e.expense_type,
        note: e.remarks,
        qty: 0,
        amount: -e.amount,
        profit: null as number | null,
      })),
      ...adjustments.map((a) => ({
        id: a.record_id,
        kind: "ADJUSTMENT" as Kind,
        date: a.date,
        at: a.created_at,
        title: a.model,
        note: `${a.type} · ${a.reason}`,
        qty: a.quantity,
        amount: 0,
        profit: null as number | null,
      })),
    ];
    const q = debounced.trim().toLowerCase();
    return all
      .filter(
        (r) =>
          (kind === "ALL" || r.kind === kind) &&
          (!q ||
            r.title.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q) ||
            (r.note ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || (b.at ?? "").localeCompare(a.at ?? ""));
  }, [purchases, sales, expenses, adjustments, debounced, kind]);

  const { visible, remaining, loadMore } = useListPaging(rows, [debounced, kind]);

  const tone = (k: Kind) =>
    k === "SALE" ? "success" : k === "PURCHASE" ? "info" : k === "EXPENSE" ? "warning" : "muted";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction History"
        subtitle="Unified timeline of all sales, stock purchases, overhead expenses and adjustments."
      />

      <Panel className="space-y-4">
        {/* Search and Category Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchField
              label="Search history"
              value={search}
              onChange={setSearch}
              placeholder="Search by model, party, ID or remarks"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap active:scale-95",
                  kind === k
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
                )}
              >
                {k === "ALL" ? "All Activity" : k}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No transactions found"
            description="All purchases, sales, expenses and adjustments will be audited here."
          />
        ) : (
          <>
            <LoadMore
              shown={visible.length}
              total={rows.length}
              remaining={remaining}
              onLoadMore={loadMore}
            />
            <ul className="space-y-2.5">
              {visible.map((r) => (
                <li
                  key={`${r.kind}-${r.id}`}
                  className="rounded-2xl border border-border/70 bg-elevated/60 p-3.5 transition-all hover:bg-elevated/90 shadow-xs flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        r.kind === "SALE" && "bg-emerald-500/15 text-emerald-400",
                        r.kind === "PURCHASE" && "bg-sky-500/15 text-sky-400",
                        r.kind === "EXPENSE" && "bg-amber-500/15 text-amber-400",
                        r.kind === "ADJUSTMENT" && "bg-purple-500/15 text-purple-400",
                      )}
                    >
                      {r.kind === "SALE" && <Tag className="size-4.5" />}
                      {r.kind === "PURCHASE" && <ShoppingCart className="size-4.5" />}
                      {r.kind === "EXPENSE" && <Receipt className="size-4.5" />}
                      {r.kind === "ADJUSTMENT" && <SlidersHorizontal className="size-4.5" />}
                    </span>

                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2">
                        <StatusPill tone={tone(r.kind)}>{r.kind}</StatusPill>
                        <span className="num text-xs text-muted-foreground font-mono">{r.id}</span>
                        <span className="text-muted-foreground/60 text-xs">·</span>
                        <span className="num text-xs text-muted-foreground">{formatDate(r.date)}</span>
                      </div>
                      <p className="truncate text-sm font-bold text-foreground mt-1">{r.title}</p>
                      {r.note && (
                        <p className="truncate text-xs text-muted-foreground mt-0.5">{r.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {r.kind === "ADJUSTMENT" ? (
                      <p
                        className={cn(
                          "num text-sm font-bold",
                          r.qty >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {r.qty >= 0 ? "+" : "-"}
                        {formatUnits(Math.abs(r.qty))} units
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "num text-sm font-bold",
                          r.amount > 0 ? "text-success" : "text-foreground",
                        )}
                      >
                        {r.amount > 0 ? "+" : ""}
                        {formatMoney(r.amount, currency)}
                      </p>
                    )}
                    {r.profit !== null && (
                      <p
                        className={cn(
                          "num text-xs font-semibold",
                          r.profit >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {r.profit >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(r.profit), currency)} Profit
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
