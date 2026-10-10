import { createFileRoute } from "@tanstack/react-router";
import { Activity as ActivityIcon, User, Filter, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EmptyState,
  Field,
  LoadMore,
  PageHeader,
  Panel,
  SearchField,
  StatusPill,
  inputClass,
} from "@/components/common/ui-bits";
import { useListPaging } from "@/hooks/use-list-paging";
import { useDebounced } from "@/hooks/useDebounced";
import { useStockStore } from "@/store/stockStore";
import type { ChangeAction, ChangeSection } from "@/types";
import { formatDateTime } from "@/utils/format";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Stockly" },
      {
        name: "description",
        content: "Audit trail of every add, edit, delete, import and export made on this device.",
      },
      { property: "og:title", content: "Activity Log — Stockly" },
      { property: "og:description", content: "A full audit trail of your shop records." },
    ],
  }),
  component: ActivityPage,
});

const ACTIONS: ChangeAction[] = ["ADD", "EDIT", "DELETE", "IMPORT", "EXPORT", "SYNC"];
const SECTIONS: ChangeSection[] = ["BUY", "SELL", "EXPENSE", "STOCK_ADJUSTMENT"];

function ActivityPage() {
  const changelogs = useStockStore((s) => s.changelogs);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [section, setSection] = useState("");
  const debounced = useDebounced(search, 300);

  const users = useMemo(
    () => Array.from(new Set(changelogs.map((c) => c.user).filter(Boolean))).sort(),
    [changelogs],
  );

  const rows = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return changelogs
      .filter(
        (c) =>
          (!user || c.user === user) &&
          (!action || c.action === action) &&
          (!section || c.section === section) &&
          (!q ||
            c.model.toLowerCase().includes(q) ||
            c.record_id.toLowerCase().includes(q) ||
            (c.remarks ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [changelogs, debounced, user, action, section]);

  const { visible, remaining, loadMore } = useListPaging(rows, [debounced, user, action, section]);

  const tone = (a: ChangeAction) =>
    a === "ADD" ? "success" : a === "DELETE" ? "destructive" : a === "EDIT" ? "info" : "muted";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & Activity Log"
        subtitle="Detailed immutable log of every record creation, edit, deletion, or sync."
      />

      <Panel className="space-y-4">
        {/* Search Field */}
        <SearchField
          label="Search activity"
          value={search}
          onChange={setSearch}
          placeholder="Search by model, record ID or audit note"
        />

        {/* Filter controls */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Filter by User" htmlFor="act-user">
            <select
              id="act-user"
              className={inputClass}
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">All Shop Users</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Filter by Action" htmlFor="act-action">
            <select
              id="act-action"
              className={inputClass}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">All Action Types</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Filter by Section" htmlFor="act-section">
            <select
              id="act-section"
              className={inputClass}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">All Record Types</option>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No audit entries found"
            description="All modifications to stock, purchases, sales and expenses are automatically logged."
          />
        ) : (
          <div className="space-y-3">
            <LoadMore
              shown={visible.length}
              total={rows.length}
              remaining={remaining}
              onLoadMore={loadMore}
            />
            <ul className="space-y-2.5">
              {visible.map((c) => (
                <li
                  key={c.change_id}
                  className="rounded-2xl border border-border/70 bg-elevated/60 p-4 transition-all hover:bg-elevated/90 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-xs">
                        {(c.user || "U").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-sm text-foreground">{c.user}</span>
                      <StatusPill tone={tone(c.action)}>
                        {c.action} {c.section}
                      </StatusPill>
                    </div>
                    <p className="num text-xs text-muted-foreground">{formatDateTime(c.timestamp)}</p>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 text-xs">
                    <div>
                      <dt className="label-xs text-[10px] text-muted-foreground/80">Record</dt>
                      <dd className="num mt-0.5 font-mono text-xs text-foreground font-semibold">
                        {c.record_id}
                      </dd>
                    </div>

                    <div>
                      <dt className="label-xs text-[10px] text-muted-foreground/80">Stock Model</dt>
                      <dd className="mt-0.5 truncate font-medium text-foreground">
                        {c.model || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="label-xs text-[10px] text-muted-foreground/80">Value Change</dt>
                      <dd className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {c.old_value || "—"} → {c.new_value || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="label-xs text-[10px] text-muted-foreground/80">Device ID</dt>
                      <dd className="num mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {c.device_id || "—"}
                      </dd>
                    </div>
                  </dl>

                  {c.remarks && (
                    <div className="mt-2.5 rounded-lg bg-card/60 p-2 text-xs text-muted-foreground/90">
                      {c.remarks}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
