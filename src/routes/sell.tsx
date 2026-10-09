import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Tag, Trash2 } from "lucide-react";
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
import { useCurrency, useInventory, useStockStore } from "@/store/stockStore";
import { formatDate, formatMoney, formatUnits, todayISO, toNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell Stock â€” Stockly" },
      {
        name: "description",
        content:
          "Sell stock with live available quantity, weighted average cost and instant profit calculation.",
      },
      { property: "og:title", content: "Sell Stock â€” Stockly" },
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

  const sellable = useMemo(
    () =>
      inventory.filter(
        (i) => i.remaining > 0 || (editingSale ? i.model === editingSale.model : false),
      ),
    [inventory, editingSale],
  );

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
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
    if (!pendingDelete) return;
    await deleteSale(pendingDelete);
    if (editingId === pendingDelete) reset();
    setPendingDelete(null);
    toast.success("Sale deleted â€” stock restored");
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
    <div className="space-y-5">
      <PageHeader title="Sell Stock" subtitle="Sell from available inventory with live profit." />

      <Panel>
        <SectionTitle>{editingId ? "Edit Sale" : "Record New Sale"}</SectionTitle>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Stock model" htmlFor="sell-model" required error={errors.model}>
            <select
              id="sell-model"
              className={inputClass}
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
            >
              <option value="">Select a model in stock</option>
              {sellable.map((i) => (
                <option key={i.model} value={i.model}>
                  {i.model} ({formatUnits(i.remaining)} in stock)
                </option>
              ))}
            </select>
          </Field>

          <Field label="Date" htmlFor="sell-date" required error={errors.date}>
            <input
              id="sell-date"
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div className="rounded-lg border border-border bg-elevated p-3">
              <p className="label-xs">Available stock</p>
              <p className="num mt-1 text-lg font-semibold">{formatUnits(available)} units</p>
            </div>
            <div className="rounded-lg border border-border bg-elevated p-3">
              <p className="label-xs">Weighted avg cost</p>
              <p className="num mt-1 text-lg font-semibold">{formatMoney(avgCost, currency)}</p>
            </div>
          </div>

          <Field label="Quantity" htmlFor="sell-qty" required error={errors.quantity}>
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
            />
          </Field>

          <Field
            label={`Selling price / unit (${currency})`}
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
            />
          </Field>

          <Field label="Customer" htmlFor="sell-customer">
            <input
              id="sell-customer"
              className={inputClass}
              value={form.customer}
              onChange={(e) => set("customer", e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Remarks" htmlFor="sell-remarks">
            <input
              id="sell-remarks"
              className={inputClass}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div className="rounded-lg border border-border bg-elevated p-3">
              <p className="label-xs">Total sale</p>
              <p className="num mt-1 text-xl font-semibold">{formatMoney(totalSale, currency)}</p>
            </div>
            <div className="rounded-lg border border-border bg-elevated p-3">
              <p className="label-xs">Estimated profit / loss</p>
              <p
                className={cn(
                  "num mt-1 text-xl font-semibold",
                  estimatedProfit >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {estimatedProfit >= 0 ? "â–² " : "â–¼ "}
                {formatMoney(estimatedProfit, currency)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button type="submit" className={btnPrimary}>
              {editingId ? "Update sale" : "Save sale"}
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
          Sales history
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
            title="No sales yet"
            description="Sales you record will appear here with profit details."
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
                <li key={s.record_id} className="rounded-xl border border-border bg-elevated p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.model}</p>
                      <p className="num text-xs text-muted-foreground">
                        {formatUnits(s.quantity)} units Â· {s.record_id} Â· {formatDate(s.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="num text-sm font-semibold">
                          {formatMoney(s.total_sale, currency)}
                        </p>
                        <p
                          className={cn(
                            "num text-xs font-semibold",
                            s.profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {s.profit >= 0 ? "â–² Profit " : "â–¼ Loss "}
                          {formatMoney(Math.abs(s.profit), currency)}
                        </p>
                      </div>
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
                        className={`${btnIcon} text-destructive hover:text-destructive`}
                        aria-label={`Delete sale ${s.record_id}`}
                        onClick={() => setPendingDelete(s.record_id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <MetaRow
                      items={[
                        { label: "Unit price", value: formatMoney(s.selling_price, currency) },
                        { label: "Customer", value: s.customer || "â€”" },
                        { label: "Remarks", value: s.remarks || "â€”" },
                        { label: "Added by", value: s.created_by || "â€”" },
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
