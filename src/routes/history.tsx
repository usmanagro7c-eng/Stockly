import { createFileRoute } from "@tanstack/react-router";
import { History as HistoryIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EmptyState,
  LoadMore,
  PageHeader,
  Panel,
  SearchField,
  StatusPill,
  btnOutline,
} from "@/components/common/ui-bits";
import { useListPaging } from "@/hooks/use-list-paging";
import { useDebounced } from "@/hooks/useDebounced";
import { useCurrency, useStockStore } from "@/store/stockStore";
import { formatDate, formatMoney, formatUnits } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History â€” Stockly" },
      {
        name: "description",
        content:
          "One chronological timeline of every purchase, sale, expense and stock adjustment.",
      },
      { property: "og:title", content: "History â€” Stockly" },
      { property: "og:description", content: "Every transaction in one timeline." },
    ],
  }),
  component: HistoryPage,
});

type Kind = "PURCHASE" | "SALE" | "EXPENSE" | "ADJUSTMENT";
const KINDS: (Kind | "ALL")[] = ["ALL", "PURCHASE", "SALE", "EXPENSE", "ADJUSTMENT"];

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
        note: `${a.type} Â· ${a.reason}`,
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
    <div className="space-y-5">
      <PageHeader title="History" subtitle="Everything that happened, newest first." />

      <Panel className="space-y-4">
        <SearchField
          label="Search history"
          value={search}
          onChange={setSearch}
          placeholder="Search by model, category, record ID or note"
        />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                btnOutline,
                "shrink-0 px-3 text-xs",
                kind === k && "border-primary/50 bg-primary/15 text-primary",
              )}
            >
              {k === "ALL" ? "All types" : k}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No transactions yet"
            description="Purchases, sales, expenses and adjustments will appear here together."
          />
        ) : (
          <>
            <LoadMore
              shown={visible.length}
              total={rows.length}
              remaining={remaining}
              onLoadMore={loadMore}
            />
            <ul className="divide-y divide-border">
              {visible.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-start gap-3 py-3">
                  <StatusPill tone={tone(r.kind)}>{r.kind}</StatusPill>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="num truncate text-xs text-muted-foreground">
                      {r.id} Â· {formatDate(r.date)}
                      {r.note ? ` Â· ${r.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.kind === "ADJUSTMENT" ? (
                      <p
                        className={cn(
                          "num text-sm font-semibold",
                          r.qty >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {r.qty >= 0 ? "+" : "-"}
                        {formatUnits(Math.abs(r.qty))} units
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "num text-sm font-semibold",
                          r.amount >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {r.amount >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(r.amount), currency)}
                      </p>
                    )}
                    {r.profit !== null ? (
                      <p
                        className={cn(
                          "num text-xs font-medium",
                          r.profit >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        Prof: {r.profit >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(r.profit), currency)}
                      </p>
                    ) : null}
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
