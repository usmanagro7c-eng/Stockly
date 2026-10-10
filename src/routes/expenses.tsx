import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, Receipt, Trash2, Tag } from "lucide-react";
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
      { title: "Expenses — Stockly" },
      {
        name: "description",
        content: "Track shop running costs by category and see their effect on net profit.",
      },
      { property: "og:title", content: "Expenses — Stockly" },
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
    <div className="space-y-6">
      <PageHeader
        title="Shop Expenses"
        subtitle="Track overhead costs, utility bills and operational spending that deduct from profits."
      />

      <Panel>
        <SectionTitle>{editingId ? "Edit Expense Record" : "Record New Expense"}</SectionTitle>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          {isReadOnly && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-400 sm:col-span-2">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span>Viewer Mode: You have read-only access to this Google Sheet. Adding or modifying expenses is disabled.</span>
            </div>
          )}

          {/* Category selection */}
          <Field label="Expense Category" htmlFor="exp-type" required error={errors.expense_type}>
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

          {/* Amount */}
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

          {/* Date */}
          <Field label="Expense Date" htmlFor="exp-date" required error={errors.date}>
            <input
              id="exp-date"
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              disabled={isReadOnly}
            />
          </Field>

          {/* Remarks */}
          <Field label="Description / Remarks" htmlFor="exp-remarks" required error={errors.remarks}>
            <input
              id="exp-remarks"
              className={inputClass}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="What was this expense for?"
              disabled={isReadOnly}
            />
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row pt-1">
            <button
              type="submit"
              className={cn(btnPrimary, "w-full sm:w-auto", isReadOnly && "cursor-not-allowed opacity-50")}
              disabled={isReadOnly}
            >
              <Receipt className="size-4" aria-hidden />
              {editingId ? "Update Expense Record" : "Save Expense"}
            </button>
            {editingId && (
              <button type="button" className={btnOutline} onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Panel>

      {/* Expense History */}
      <Panel className="space-y-4">
        <SectionTitle
          right={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtered Total:</span>
              <span className="num text-sm font-bold text-destructive">
                -{formatMoney(total, currency)}
              </span>
            </div>
          }
        >
          Expense History
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
            description="Shop expenses you record will appear here."
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
                <li
                  key={e.record_id}
                  className="rounded-2xl border border-border/70 bg-elevated/60 p-4 transition-all hover:bg-elevated/90 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          {e.expense_type}
                        </span>
                        <span className="num text-xs text-muted-foreground font-mono">{e.record_id}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-1.5">{e.remarks}</p>
                      <p className="num text-xs text-muted-foreground mt-0.5">{formatDate(e.date)}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="num text-sm font-bold text-destructive">
                        -{formatMoney(e.amount, currency)}
                      </span>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
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
                            className={`${btnIcon} text-destructive hover:text-destructive hover:bg-destructive/10`}
                            aria-label={`Delete expense ${e.record_id}`}
                            onClick={() => setPendingDelete(e.record_id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {e.created_by && (
                    <div className="mt-2.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      Logged by: <span className="font-medium text-foreground">{e.created_by}</span>
                    </div>
                  )}
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
