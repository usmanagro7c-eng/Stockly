import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, ShoppingCart, Trash2 } from "lucide-react";
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
import { useCurrency, useInventory, useIsReadOnly, useStockStore } from "@/store/stockStore";
import { formatDate, formatMoney, formatUnits, todayISO, toNumber } from "@/utils/format";


export const Route = createFileRoute("/buy")({
  head: () => ({
    meta: [
      { title: "Buy Stock â€” Stockly" },
      {
        name: "description",
        content:
          "Record stock purchases with supplier, quantity and unit cost, and review history.",
      },
      { property: "og:title", content: "Buy Stock â€” Stockly" },
      { property: "og:description", content: "Record and manage your stock purchases." },
    ],
  }),
  component: BuyPage,
});

interface FormState {
  model: string;
  quantity: string;
  buying_price: string;
  date: string;
  supplier: string;
  remarks: string;
}

const emptyForm = (): FormState => ({
  model: "",
  quantity: "",
  buying_price: "",
  date: todayISO(),
  supplier: "",
  remarks: "",
});

function BuyPage() {
  const purchases = useStockStore((s) => s.purchases);
  const savePurchase = useStockStore((s) => s.savePurchase);
  const deletePurchase = useStockStore((s) => s.deletePurchase);
  const inventory = useInventory();
  const currency = useCurrency();
  const isReadOnly = useIsReadOnly();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const totalCost = toNumber(form.quantity) * toNumber(form.buying_price);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.model.trim()) next.model = "Stock model name is required";
    const qty = toNumber(form.quantity);
    if (!form.quantity.trim() || qty <= 0) next.quantity = "Enter a quantity greater than 0";
    else if (!Number.isInteger(qty)) next.quantity = "Quantity must be a whole number";
    const price = toNumber(form.buying_price);
    if (!form.buying_price.trim() || price < 0) next.buying_price = "Enter a valid buying price";
    if (!form.date) next.date = "Date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error("Viewer mode: You have read-only access and cannot save purchases.");
      return;
    }
    if (!validate()) {
      toast.error("Please fill required fields");
      return;
    }
    await savePurchase(
      {
        date: form.date,
        model: form.model,
        quantity: toNumber(form.quantity),
        buying_price: toNumber(form.buying_price),
        supplier: form.supplier,
        remarks: form.remarks,
      },
      editingId ?? undefined,
    );
    toast.success(editingId ? "Purchase updated!" : "Purchase saved!");
    reset();
  };

  const startEdit = (id: string) => {
    if (isReadOnly) {
      toast.error("Viewer mode: Editing purchases is disabled.");
      return;
    }
    const p = purchases.find((row) => row.record_id === id);
    if (!p) return;
    setEditingId(id);
    setForm({
      model: p.model,
      quantity: String(p.quantity),
      buying_price: String(p.buying_price),
      date: p.date,
      supplier: p.supplier,
      remarks: p.remarks,
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (isReadOnly) {
      toast.error("Viewer mode: Deleting purchases is disabled.");
      return;
    }
    if (!pendingDelete) return;
    await deletePurchase(pendingDelete);
    if (editingId === pendingDelete) reset();
    setPendingDelete(null);
    toast.success("Purchase deleted");
  };


  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return purchases
      .filter(
        (p) =>
          !q ||
          p.model.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q) ||
          p.record_id.toLowerCase().includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [purchases, debounced]);

  // Rows are sorted newest-first, so a freshly saved purchase is always at the
  // top of page one without needing an extra reset.
  const { visible, remaining, loadMore } = useListPaging(filtered, [debounced]);

  return (
    <div className="space-y-5">
      <PageHeader title="Buy Stock" subtitle="Record purchases and keep your inventory accurate." />

      <Panel>
        <SectionTitle>{editingId ? "Edit Purchase" : "Record New Purchase"}</SectionTitle>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          {isReadOnly && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-600 dark:text-amber-400 sm:col-span-2">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span>Viewer Mode: You have read-only access to this Google Sheet. Adding or modifying purchases is disabled.</span>
            </div>
          )}
          <Field label="Stock model name" htmlFor="buy-model" required error={errors.model}>
            <input
              id="buy-model"
              list="buy-models"
              className={inputClass}
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder="Select existing or type a new model"
              disabled={isReadOnly}
            />
            <datalist id="buy-models">
              {inventory.map((i) => (
                <option key={i.model} value={i.model} />
              ))}
            </datalist>
          </Field>

          <Field label="Date" htmlFor="buy-date" required error={errors.date}>
            <input
              id="buy-date"
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              disabled={isReadOnly}
            />
          </Field>

          <Field label="Quantity" htmlFor="buy-qty" required error={errors.quantity}>
            <input
              id="buy-qty"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              className={inputClass}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="0"
              disabled={isReadOnly}
            />
          </Field>

          <Field
            label={`Buying price / unit (${currency})`}
            htmlFor="buy-price"
            required
            error={errors.buying_price}
          >
            <input
              id="buy-price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={inputClass}
              value={form.buying_price}
              onChange={(e) => set("buying_price", e.target.value)}
              placeholder="0.00"
              disabled={isReadOnly}
            />
          </Field>

          <Field label="Supplier" htmlFor="buy-supplier">
            <input
              id="buy-supplier"
              className={inputClass}
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="Optional"
              disabled={isReadOnly}
            />
          </Field>

          <Field label="Remarks" htmlFor="buy-remarks">
            <input
              id="buy-remarks"
              className={inputClass}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Optional"
              disabled={isReadOnly}
            />
          </Field>

          <div className="rounded-lg border border-border bg-elevated p-3 sm:col-span-2">
            <p className="label-xs">Total cost</p>
            <p className="num mt-1 text-xl font-semibold">{formatMoney(totalCost, currency)}</p>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button
              type="submit"
              className={btnPrimary}
              disabled={isReadOnly}
              title={isReadOnly ? "Viewer mode: Read-only access" : undefined}
            >
              {isReadOnly ? "Read-Only (Viewer Mode)" : editingId ? "Update purchase" : "Save purchase"}
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
          right={<span className="num text-sm text-muted-foreground">{filtered.length}</span>}
        >
          Purchase history
        </SectionTitle>
        <SearchField
          label="Search purchases"
          value={search}
          onChange={setSearch}
          placeholder="Search by model, supplier or record ID"
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchases yet"
            description="Start by recording your first purchase."
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
              {visible.map((p) => (
                <li key={p.record_id} className="rounded-xl border border-border bg-elevated p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.model}</p>
                      <p className="num text-xs text-muted-foreground">
                        {formatUnits(p.quantity)} units Â· {p.record_id} Â· {formatDate(p.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-semibold">
                        {formatMoney(p.total_cost, currency)}
                      </span>
                      {!isReadOnly && (
                        <>
                          <button
                            type="button"
                            className={btnIcon}
                            aria-label={`Edit purchase ${p.record_id}`}
                            onClick={() => startEdit(p.record_id)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnIcon} text-destructive hover:text-destructive`}
                            aria-label={`Delete purchase ${p.record_id}`}
                            onClick={() => setPendingDelete(p.record_id)}
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
                        { label: "Buy price", value: formatMoney(p.buying_price, currency) },
                        { label: "Supplier", value: p.supplier || "â€”" },
                        { label: "Remarks", value: p.remarks || "â€”" },
                        { label: "Added by", value: p.created_by || "â€”" },
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
        title="Delete this purchase?"
        description="This purchase will be removed permanently and your stock, investment and profit figures will be recalculated."
        confirmLabel="Delete purchase"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
