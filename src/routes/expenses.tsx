import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, Receipt, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  EmptyState,
  Field,
  LoadMore,
  MetaRow,
  PageHeader,
  Panel,
  SearchField,
  SectionTitle,
  btnIcon,
  btnOutline,
  btnPrimary,
  inputClass,
} from "@/components/common/ui-bits";
import { useListPaging } from "@/hooks/use-list-paging";
import { useDebounced } from "@/hooks/useDebounced";
import { useCurrency, useIsReadOnly, useStockStore } from "@/store/stockStore";
import { EXPENSE_CATEGORIES } from "@/types";
import { formatDate, formatMoney, todayISO, toNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses â€” Stockly" },
      {
        name: "description",
        content: "Track shop running costs by category and see their effect on net profit.",
      },
      { property: "og:title", content: "Expenses â€” Stockly" },
      { property: "og:description", content: "Track shop expenses by category." },
    ],
  }),
  component: ExpensesPage,
});

interface FormState {
  expense_type: string;
  amount: string;
  date: string;
  remarks: string;
}

const emptyForm = (): FormState => ({
  expense_type: "",
  amount: "",
  date: todayISO(),
  remarks: "",
});

function ExpensesPage() {
  const expenses = useStockStore((s) => s.expenses);
  const saveExpense = useStockStore((s) => s.saveExpense);
  const deleteExpense = useStockStore((s) => s.deleteExpense);
  const currency = useCurrency();
  const isReadOnly = useIsReadOnly();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const reset = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error("Viewer mode: You have read-only access and cannot save expenses.");
      return;
    }
    const next: Record<string, string> = {};
    if (!form.expense_type) next.expense_type = "Choose a category";
    const amount = toNumber(form.amount);
    if (!form.amount.trim() || amount <= 0) next.amount = "Enter an amount greater than 0";
    if (!form.date) next.date = "Date is required";
    if (!form.remarks.trim()) next.remarks = "Remarks are required";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fill required fields");
      return;
    }
    await saveExpense(
      { date: form.date, expense_type: form.expense_type, amount, remarks: form.remarks },
      editingId ?? undefined,
    );
    toast.success(editingId ? "Expense updated!" : "Expense recorded!");
    reset();
  };

  const startEdit = (id: string) => {
    if (isReadOnly) {
      toast.error("Viewer mode: Editing expenses is disabled.");
      return;
    }
    const row = expenses.find((e) => e.record_id === id);
    if (!row) return;
    setEditingId(id);
    setForm({
      expense_type: row.expense_type,
      amount: String(row.amount),
      date: row.date,
      remarks: row.remarks,
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (isReadOnly || !pendingDelete) return;
    await deleteExpense(pendingDelete);
    if (editingId === pendingDelete) reset();
    setPendingDelete(null);
    toast.success("Expense deleted");
  };

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return expenses
      .filter(
        (e) =>
          !q ||
          e.expense_type.toLowerCase().includes(q) ||
          e.remarks.toLowerCase().includes(q) ||
          e.record_id.toLowerCase().includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [expenses, debounced]);

  const total = useMemo(() => filtered.reduce((t, e) => t + e.amount, 0), [filtered]);

  const { visible, remaining, loadMore } = useListPaging(filtered, [debounced]);

  return (
    <div className="space-y-5">
      <PageHeader title="Expenses" subtitle="Running costs that reduce your net profit." />

      <Panel>
        <SectionTitle>{editingId ? "Edit Expense" : "Record New Expense"}</SectionTitle>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          {isReadOnly && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-600 dark:text-amber-400 sm:col-span-2">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span>Viewer Mode: You have read-only access to this Google Sheet. Adding or modifying expenses is disabled.</span>
            </div>
          )}
          <Field label="Category" htmlFor="exp-type" required error={errors.expense_type}>
            <select
              id="exp-type"
              className={inputClass}
              value={form.expense_type}
              onChange={(e) => set("expense_type", e.target.value)}
              disabled={isReadOnly}
            >
              <option value="">Select a category</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Amount (${currency})`} htmlFor="exp-amount" required error={errors.amount}>
            <input
              id="exp-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={inputClass}
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
              disabled={isReadOnly}
            />
          </Field>

          <Field label="Date" htmlFor="exp-date" required error={errors.date}>
            <input
              id="exp-date"
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              disabled={isReadOnly}
            />
          </Field>

          <Field label="Remarks" htmlFor="exp-remarks" required error={errors.remarks}>
            <input
              id="exp-remarks"
              className={inputClass}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="What was this for?"
              disabled={isReadOnly}
            />
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button
              type="submit"
              className={cn(btnPrimary, isReadOnly && "cursor-not-allowed opacity-50")}
              disabled={isReadOnly}
            >
              {editingId ? "Update expense" : "Save expense"}
            </button>
            {editingId ? (
              <button type="button" className={btnOutline} onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel className="space-y-4">
        <SectionTitle
          right={
            <span className="num text-sm text-muted-foreground">
              {formatMoney(total, currency)}
            </span>
          }
        >
          Expense history
        </SectionTitle>
        <SearchField
          label="Search expenses"
          value={search}
          onChange={setSearch}
          placeholder="Search by category, remarks or record ID"
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses found"
            description="Your expense records will appear here."
          />
        ) : (
          <>
            <LoadMore
              shown={visible.length}
              total={filtered.length}
              remaining={remaining}
              onLoadMore={loadMore}
            />
            <ul className="space-y-3">
              {visible.map((e) => (
                <li key={e.record_id} className="rounded-xl border border-border bg-elevated p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{e.expense_type}</p>
                      <p className="num text-xs text-muted-foreground">
                        {e.record_id} · {formatDate(e.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-semibold text-destructive">
                        -{formatMoney(e.amount, currency)}
                      </span>
                      {!isReadOnly && (
                        <>
                          <button
                            type="button"
                            className={btnIcon}
                            aria-label={`Edit expense ${e.record_id}`}
                            onClick={() => startEdit(e.record_id)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnIcon} text-destructive hover:text-destructive`}
                            aria-label={`Delete expense ${e.record_id}`}
                            onClick={() => setPendingDelete(e.record_id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <MetaRow
                      items={[
                        { label: "Remarks", value: e.remarks || "â€”" },
                        { label: "Added by", value: e.created_by || "â€”" },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this expense?"
        description="The expense will be removed permanently and your net profit will be recalculated."
        confirmLabel="Delete expense"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
