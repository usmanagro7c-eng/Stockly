import { createFileRoute } from "@tanstack/react-router";
import { Eye, Pencil, Tag, Trash2, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Package, User } from "lucide-react";
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
  StatusPill,
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

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell Stock — Stockly" },
      {
        name: "description",
        content:
          "Sell stock with live available quantity, weighted average cost and instant profit calculation.",
      },
      { property: "og:title", content: "Sell Stock — Stockly" },
      { property: "og:description", content: "Record sales and see profit per transaction." },
    ],
  }),
  component: SellPage,
});

interface FormState {
  model: string;
  quantity: string;
  selling_price: string;
  date: string;
  customer: string;
  remarks: string;
}

const emptyForm = (): FormState => ({
  model: "",
  quantity: "",
  selling_price: "",
  date: todayISO(),
  customer: "",
  remarks: "",
});

function SellPage() {
  const sales = useStockStore((s) => s.sales);
  const saveSale = useStockStore((s) => s.saveSale);
  const deleteSale = useStockStore((s) => s.deleteSale);
  const threshold = useStockStore((s) => s.settings.low_stock_threshold);
  const inventory = useInventory();
  const currency = useCurrency();
  const isReadOnly = useIsReadOnly();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const editingSale = editingId ? sales.find((s) => s.record_id === editingId) : undefined;
  const item = inventory.find((i) => i.model === form.model);
  // When editing, the sale's own quantity is still counted as sold, so add it back.
  const available =
    (item?.remaining ?? 0) +
    (editingSale && editingSale.model === form.model ? editingSale.quantity : 0);
  const avgCost = item?.avg_cost ?? 0;
  const qty = toNumber(form.quantity);
  const totalSale = qty * toNumber(form.selling_price);
  const estimatedProfit = totalSale - qty * avgCost;
  const profitMargin = totalSale > 0 ? (estimatedProfit / totalSale) * 100 : 0;

  const sellable = useMemo(
    () =>
      inventory.filter(
        (i) => i.remaining > 0 || (editingSale ? i.model === editingSale.model : false),
      ),
    [inventory, editingSale],
  );

  const modelOptions = useMemo<ComboboxOption[]>(() => {
    return sellable.map((i) => {
      const isLow = i.remaining <= threshold;
      return {
        value: i.model,
        label: i.model,
        icon: Package,
        sublabel: `Cost: ${formatMoney(i.avg_cost, currency)}`,
        badge: (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
              isLow
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
            )}
          >
            {formatUnits(i.remaining)} left
          </span>
        ),
      };
    });
  }, [sellable, currency, threshold]);

  const customerOptions = useMemo<ComboboxOption[]>(() => {
    const list = Array.from(new Set(sales.map((s) => s.customer.trim()).filter(Boolean)));
    return list.map((c) => ({
      value: c,
      label: c,
      icon: User,
    }));
  }, [sales]);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const addQty = (amount: number) => {
    const current = toNumber(form.quantity);
    const next = Math.min(available, current + amount);
    set("quantity", String(next));
  };

  const setMaxQty = () => {
    if (available > 0) set("quantity", String(available));
  };

  const reset = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.model.trim()) next.model = "Select a stock model";
    if (!form.quantity.trim() || qty <= 0) next.quantity = "Enter a quantity greater than 0";
    else if (!Number.isInteger(qty)) next.quantity = "Quantity must be a whole number";
    else if (qty > available)
      next.quantity = `Only ${formatUnits(available)} units are available for ${form.model}.`;
    const price = toNumber(form.selling_price);
    if (!form.selling_price.trim() || price < 0) next.selling_price = "Enter a valid selling price";
    if (!form.date) next.date = "Date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error("Viewer mode: You have read-only access and cannot save sales.");
      return;
    }
    if (!validate()) {
      if (qty > available && form.model)
        toast.error(`Cannot sell more than available stock! Only ${formatUnits(available)} left.`);
      else toast.error("Please fill required fields");
      return;
    }
    await saveSale(
      {
        date: form.date,
        model: form.model,
        quantity: qty,
        selling_price: toNumber(form.selling_price),
        profit: estimatedProfit,
        customer: form.customer,
        remarks: form.remarks,
      },
      editingId ?? undefined,
    );
    toast.success(editingId ? "Sale updated!" : "Sale recorded!");
    const remainingAfter = available - qty;
    if (remainingAfter > 0 && remainingAfter <= threshold) {
      toast.warning(
        `Low stock alert: ${form.model} has only ${formatUnits(remainingAfter)} units left`,
      );
    }
    reset();
  };

  const startEdit = (id: string) => {
    if (isReadOnly) {
      toast.error("Viewer mode: Editing sales is disabled.");
      return;
    }
    const s = sales.find((row) => row.record_id === id);
    if (!s) return;
    setEditingId(id);
    setForm({
      model: s.model,
      quantity: String(s.quantity),
      selling_price: String(s.selling_price),
      date: s.date,
      customer: s.customer,
      remarks: s.remarks,
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (isReadOnly || !pendingDelete) return;
    await deleteSale(pendingDelete);
    if (editingId === pendingDelete) reset();
    setPendingDelete(null);
    toast.success("Sale deleted — stock restored");
  };

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return sales
      .filter(
        (s) =>
          !q ||
          s.model.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q) ||
          s.record_id.toLowerCase().includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [sales, debounced]);

  const { visible, remaining, loadMore } = useListPaging(filtered, [debounced]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sell Stock"
        subtitle="Record sales & track profit."
      />

      <Panel>
        <SectionTitle>{editingId ? "Edit Sale" : "New Sale"}</SectionTitle>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          {isReadOnly && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-medium text-amber-400 sm:col-span-2">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span>Viewer Mode: Read-only access to this sheet.</span>
            </div>
          )}

          {/* Model selection */}
          <Field label="Model" htmlFor="sell-model" required error={errors.model}>
            <ComboboxSelect
              id="sell-model"
              value={form.model}
              onChange={(val) => set("model", val)}
              options={modelOptions}
              placeholder="Select model in stock..."
              searchPlaceholder="Search model..."
              disabled={isReadOnly}
              emptyText="No items in stock"
            />
          </Field>

          {/* Date */}
          <Field label="Date" htmlFor="sell-date" required error={errors.date}>
            <input
              id="sell-date"
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
              <div className="flex items-center gap-2">
                <label htmlFor="sell-qty" className="label-xs block text-muted-foreground font-semibold">
                  Quantity <span className="text-destructive font-bold">*</span>
                </label>
                {form.model && (
                  <span className={cn("text-[11px] font-medium num", available <= threshold ? "text-amber-400" : "text-muted-foreground")}>
                    ({formatUnits(available)} available)
                  </span>
                )}
              </div>
              {available > 0 && !isReadOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => addQty(1)}
                    className="rounded-md border border-border/80 bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground active:scale-95"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => addQty(5)}
                    className="rounded-md border border-border/80 bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground active:scale-95"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={setMaxQty}
                    className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 active:scale-95"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>
            <input
              id="sell-qty"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              max={available || undefined}
              className={inputClass}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="0"
              disabled={isReadOnly}
            />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
          </div>

          {/* Selling Price */}
          <Field
            label={`Price / Unit (${currency})`}
            htmlFor="sell-price"
            required
            error={errors.selling_price}
          >
            <input
              id="sell-price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={inputClass}
              value={form.selling_price}
              onChange={(e) => set("selling_price", e.target.value)}
              placeholder="0.00"
              disabled={isReadOnly}
            />
          </Field>

          {/* Customer */}
          <Field label="Customer" htmlFor="sell-customer">
            <ComboboxSelect
              id="sell-customer"
              value={form.customer}
              onChange={(val) => set("customer", val)}
              options={customerOptions}
              placeholder="Walk-in / Customer name"
              searchPlaceholder="Search or enter customer..."
              allowCustom={true}
              customActionLabel={(txt) => `Use "${txt}"`}
              disabled={isReadOnly}
            />
          </Field>

          {/* Remarks */}
          <Field label="Notes" htmlFor="sell-remarks">
            <input
              id="sell-remarks"
              className={inputClass}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Optional notes or invoice #"
              disabled={isReadOnly}
            />
          </Field>

          {/* Digital POS Receipt Live Summary Card */}
          <div className="rounded-2xl border border-border/70 bg-elevated/50 p-4 sm:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Total Sale</p>
                <p className="num mt-0.5 text-xl font-bold text-foreground">
                  {formatMoney(totalSale, currency)}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Cost (COGS)</p>
                <p className="num mt-0.5 text-xl font-semibold text-muted-foreground">
                  {formatMoney(qty * avgCost, currency)}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[11px] font-medium text-muted-foreground">Est. Profit</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p
                    className={cn(
                      "num text-xl font-bold flex items-center gap-1",
                      estimatedProfit >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {estimatedProfit >= 0 ? (
                      <TrendingUp className="size-4 text-success" />
                    ) : (
                      <TrendingDown className="size-4 text-destructive" />
                    )}
                    {formatMoney(estimatedProfit, currency)}
                  </p>
                  {totalSale > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                        estimatedProfit >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {profitMargin.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row pt-1">
            <button
              type="submit"
              className={cn(btnPrimary, "w-full sm:w-auto", isReadOnly && "cursor-not-allowed opacity-50")}
              disabled={isReadOnly}
            >
              <Tag className="size-4" aria-hidden />
              {editingId ? "Update Sale" : "Save Sale"}
            </button>
            {editingId && (
              <button type="button" className={btnOutline} onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Panel>

      {/* Sales History */}
      <Panel className="space-y-4">
        <SectionTitle
          right={<span className="num text-xs font-semibold px-2 py-0.5 rounded-full bg-elevated text-muted-foreground">{filtered.length} records</span>}
        >
          Sales History
        </SectionTitle>

        <SearchField
          label="Search sales"
          value={search}
          onChange={setSearch}
          placeholder="Search by model, customer or record ID"
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No sales found"
            description="Sales transactions will appear here with live profit breakdown."
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
              {visible.map((s) => (
                <li
                  key={s.record_id}
                  className="rounded-2xl border border-border/70 bg-elevated/60 p-4 transition-all hover:bg-elevated/90 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{s.model}</p>
                      <p className="num text-xs text-muted-foreground mt-0.5">
                        {formatUnits(s.quantity)} units · {s.record_id} · {formatDate(s.date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="num text-sm font-bold text-foreground">
                          {formatMoney(s.total_sale, currency)}
                        </p>
                        <p
                          className={cn(
                            "num text-xs font-semibold flex items-center justify-end gap-1",
                            s.profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {s.profit >= 0 ? "+" : "-"}
                          {formatMoney(Math.abs(s.profit), currency)} Profit
                        </p>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className={btnIcon}
                            aria-label={`Edit sale ${s.record_id}`}
                            onClick={() => startEdit(s.record_id)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${btnIcon} text-destructive hover:text-destructive hover:bg-destructive/10`}
                            aria-label={`Delete sale ${s.record_id}`}
                            onClick={() => setPendingDelete(s.record_id)}
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
                        { label: "Unit Price", value: formatMoney(s.selling_price, currency) },
                        { label: "Customer", value: s.customer || "Walk-in" },
                        { label: "Remarks", value: s.remarks || "—" },
                        { label: "Logged By", value: s.created_by || "—" },
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
        title="Delete this sale?"
        description="Stock will be restored and profit figures recalculated. This cannot be undone."
        confirmLabel="Delete sale"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
