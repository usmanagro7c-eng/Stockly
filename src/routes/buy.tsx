import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, ShoppingCart, Trash2, ArrowDownLeft, Building2, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ComboboxSelect, type ComboboxOption } from "@/components/common/ComboboxSelect";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buy")({
  head: () => ({
    meta: [
      { title: "Buy Stock — Stockly" },
      {
        name: "description",
        content:
          "Record stock purchases with supplier, quantity and unit cost, and review history.",
      },
      { property: "og:title", content: "Buy Stock — Stockly" },
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

  const modelOptions = useMemo<ComboboxOption[]>(() => {
    return inventory.map((i) => ({
      value: i.model,
      label: i.model,
      icon: Package,
      sublabel: `Current stock: ${formatUnits(i.remaining)} units · Avg Cost: ${formatMoney(i.avg_cost, currency)}`,
      badge: (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {formatUnits(i.remaining)} in stock
        </span>
      ),
    }));
  }, [inventory, currency]);

  const supplierOptions = useMemo<ComboboxOption[]>(() => {
    const list = Array.from(new Set(purchases.map((p) => p.supplier.trim()).filter(Boolean)));
    return list.map((s) => ({
      value: s,
      label: s,
      icon: Building2,
    }));
  }, [purchases]);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const addQty = (amount: number) => {
    const current = toNumber(form.quantity);
    set("quantity", String(current + amount));
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

  const { visible, remaining, loadMore } = useListPaging(filtered, [debounced]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buy Stock"
        subtitle="Record incoming inventory shipments, unit costs, and supplier info."
      />

      <Panel>
        <SectionTitle>{editingId ? "Edit Purchase Record" : "Record Incoming Stock"}</SectionTitle>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          {isReadOnly && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-400 sm:col-span-2">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span>Viewer Mode: You have read-only access to this Google Sheet. Adding or modifying purchases is disabled.</span>
            </div>
          )}

          {/* Model name */}
          <Field label="Stock Model Name" htmlFor="buy-model" required error={errors.model}>
            <ComboboxSelect
              id="buy-model"
              value={form.model}
              onChange={(val) => set("model", val)}
              options={modelOptions}
              placeholder="Search existing or type new model name..."
              searchPlaceholder="Type model name..."
              allowCustom={true}
              customActionLabel={(txt) => `+ Add "${txt}" as new stock model`}
              disabled={isReadOnly}
            />
          </Field>

          {/* Date */}
          <Field label="Purchase Date" htmlFor="buy-date" required error={errors.date}>
            <input
              id="buy-date"
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              disabled={isReadOnly}
            />
          </Field>

          {/* Quantity with quick chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="buy-qty" className="label-xs block text-muted-foreground font-semibold">
                Quantity <span className="text-destructive font-bold">*</span>
              </label>
              {!isReadOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => addQty(5)}
                    className="rounded-md border border-border/80 bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground active:scale-95"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => addQty(10)}
                    className="rounded-md border border-border/80 bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground active:scale-95"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => addQty(50)}
                    className="rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400 hover:bg-sky-500/20 active:scale-95"
                  >
                    +50
                  </button>
                </div>
              )}
            </div>
            <input
              id="buy-qty"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              className={inputClass}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="Number of units"
              disabled={isReadOnly}
            />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
          </div>

          {/* Buying price */}
          <Field
            label={`Buying Price / Unit (${currency})`}
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

          {/* Supplier */}
          <Field label="Supplier / Vendor" htmlFor="buy-supplier">
            <ComboboxSelect
              id="buy-supplier"
              value={form.supplier}
              onChange={(val) => set("supplier", val)}
              options={supplierOptions}
              placeholder="e.g. Vendor name or wholesale market"
              searchPlaceholder="Type or search vendor..."
              allowCustom={true}
              customActionLabel={(txt) => `Use "${txt}" as vendor`}
              disabled={isReadOnly}
            />
          </Field>

          {/* Remarks */}
          <Field label="Remarks / Invoice #" htmlFor="buy-remarks">
            <input
              id="buy-remarks"
              className={inputClass}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Bill number, batch note, etc."
              disabled={isReadOnly}
            />
          </Field>

          {/* Live Investment Summary */}
          <div className="rounded-2xl border border-border/80 bg-elevated/70 p-4 sm:col-span-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-xs text-muted-foreground font-semibold">Total Purchase Cost</p>
                <p className="num mt-1 text-2xl font-bold text-foreground">
                  {formatMoney(totalCost, currency)}
                </p>
              </div>
              {toNumber(form.quantity) > 0 && toNumber(form.buying_price) > 0 && (
                <div className="text-right text-xs text-muted-foreground">
                  <p>{formatUnits(toNumber(form.quantity))} units</p>
                  <p>@ {formatMoney(toNumber(form.buying_price), currency)} each</p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row pt-1">
            <button
              type="submit"
              className={cn(btnPrimary, "w-full sm:w-auto", isReadOnly && "cursor-not-allowed opacity-50")}
              disabled={isReadOnly}
              title={isReadOnly ? "Viewer mode: Read-only access" : undefined}
            >
              <ShoppingCart className="size-4" aria-hidden />
              {isReadOnly ? "Read-Only (Viewer Mode)" : editingId ? "Update Purchase Record" : "Save Stock Purchase"}
            </button>
            {editingId && (
              <button type="button" className={btnOutline} onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Panel>

      {/* Purchase History */}
      <Panel className="space-y-4">
        <SectionTitle
          right={<span className="num text-xs font-semibold px-2 py-0.5 rounded-full bg-elevated text-muted-foreground">{filtered.length} records</span>}
        >
          Purchase History
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
            title="No purchases recorded yet"
            description="Incoming inventory records will appear here."
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
                <li
                  key={p.record_id}
                  className="rounded-2xl border border-border/70 bg-elevated/60 p-4 transition-all hover:bg-elevated/90 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{p.model}</p>
                      <p className="num text-xs text-muted-foreground mt-0.5">
                        {formatUnits(p.quantity)} units · {p.record_id} · {formatDate(p.date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="num text-sm font-bold text-foreground">
                          {formatMoney(p.total_cost, currency)}
                        </span>
                        <p className="num text-xs text-muted-foreground">
                          {formatMoney(p.buying_price, currency)} / unit
                        </p>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
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
                            className={`${btnIcon} text-destructive hover:text-destructive hover:bg-destructive/10`}
                            aria-label={`Delete purchase ${p.record_id}`}
                            onClick={() => setPendingDelete(p.record_id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border/60 pt-3">
                    <MetaRow
                      items={[
                        { label: "Unit Cost", value: formatMoney(p.buying_price, currency) },
                        { label: "Supplier", value: p.supplier || "—" },
                        { label: "Remarks", value: p.remarks || "—" },
                        { label: "Logged By", value: p.created_by || "—" },
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
