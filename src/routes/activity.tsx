import { createFileRoute } from "@tanstack/react-router";
import { Activity as ActivityIcon } from "lucide-react";
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
      { title: "Activity Log â€” Stockly" },
      {
        name: "description",
        content: "Audit trail of every add, edit, delete, import and export made on this device.",
      },
      { property: "og:title", content: "Activity Log â€” Stockly" },
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
    <div className="space-y-5">
      <PageHeader title="Activity" subtitle="Who changed what, and when." />

      <Panel className="space-y-4">
        <SearchField
          label="Search activity"
          value={search}
          onChange={setSearch}
          placeholder="Search by model, record ID or remarks"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="User" htmlFor="act-user">
            <select
              id="act-user"
              className={inputClass}
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Action" htmlFor="act-action">
            <select
              id="act-action"
              className={inputClass}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section" htmlFor="act-section">
            <select
              id="act-section"
              className={inputClass}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">All sections</option>
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
            title="No activity found"
            description="Changes you make to records will be logged here automatically."
          />
        ) : (
          <div className="space-y-3">
            <LoadMore
              shown={visible.length}
              total={rows.length}
              remaining={remaining}
              onLoadMore={loadMore}
            />
            <ul className="space-y-3">
              {visible.map((c) => (
                <li key={c.change_id} className="rounded-xl border border-border bg-elevated p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm">
                      <span className="font-semibold">{c.user}</span>{" "}
                      <StatusPill tone={tone(c.action)}>
                        {c.action} {c.section}
                      </StatusPill>{" "}
                      <span className="text-muted-foreground">
                        {c.model || "â€”"} / {c.record_id}
                      </span>
                    </p>
                    <p className="num text-xs text-muted-foreground">
                      {formatDateTime(c.timestamp)}
                    </p>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    <div>
                      <dt className="label-xs">Device</dt>
                      <dd className="num text-xs">{c.device_id || "â€”"}</dd>
                    </div>
                    <div>
                      <dt className="label-xs">Record</dt>
                      <dd className="num truncate text-xs">{c.record_id}</dd>
                    </div>
                    <div>
                      <dt className="label-xs">Change</dt>
                      <dd className="num truncate text-xs">
                        {c.old_value || "â€”"} â†’ {c.new_value || "â€”"}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-xs">Remarks</dt>
                      <dd className="truncate text-xs">{c.remarks || "â€”"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
