import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  SearchField,
  StatusPill,
  btnOutline,
  btnPrimary,
  btnIcon,
  inputClass,
} from "@/components/common/ui-bits";
import { useDebounced } from "@/hooks/useDebounced";
import { useCurrency, useInventory, useIsReadOnly, useStockStore } from "@/store/stockStore";
import { ADJUSTMENT_TYPES, type AdjustmentType, type InventoryItem } from "@/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatUnits,
  todayISO,
  toNumber,
} from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: "Stock Inventory — Stockly" },
      {
        name: "description",
        content:
          "See remaining units, average cost and estimated value for every model, and adjust stock.",
      },
      { property: "og:title", content: "Stock Inventory — Stockly" },
      { property: "og:description", content: "Remaining units and value per model." },
    ],
  }),
  component: StockPage,
});

const statusTone = (status: InventoryItem["status"]) =>
  status === "IN STOCK" ? "success" : status === "LOW STOCK" ? "warning" : "destructive";

function StockPage() {
  const inventory = useInventory();
  const currency = useCurrency();
  const isReadOnly = useIsReadOnly();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return inventory.filter(
      (i) =>
        (!q || i.model.toLowerCase().includes(q)) &&
        (!lowOnly || i.status === "LOW STOCK" || i.status === "OUT OF STOCK"),
    );
  }, [inventory, debounced, lowOnly]);

  const totalValue = filtered.reduce((t, i) => t + i.estimated_value, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Inventory"
        subtitle={`Estimated value ${formatMoney(totalValue, currency)}`}
        action={
          !isReadOnly ? (
            <button type="button" className={btnPrimary} onClick={() => setAdjustOpen(true)}>
              <Plus className="size-4" aria-hidden /> Adjust
            </button>
          ) : undefined
        }
      />

      <Panel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchField
            label="Search stock"
            value={search}
            onChange={setSearch}
            placeholder="Search by model"
          />
          <button
            type="button"
            onClick={() => setLowOnly((v) => !v)}
            aria-pressed={lowOnly}
            className={cn(
              btnOutline,
              "shrink-0",
              lowOnly && "border-warning/50 bg-warning/15 text-warning",
            )}
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Low stock
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Stock is empty"
            description="Buy some inventory to start tracking stock."
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((item) => (
              <li key={item.model}>
                <button
                  type="button"
                  onClick={() => setDetail(item.model)}
                  className="w-full rounded-xl border border-border bg-elevated p-3.5 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.model}</p>
                      <p className="num text-xs text-muted-foreground">
                        {formatUnits(item.remaining)} units remaining
                      </p>
                    </div>
                    <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 sm:grid-cols-5">
                    {[
                      { label: "Bought", value: formatUnits(item.bought) },
                      { label: "Sold", value: formatUnits(item.sold) },
                      { label: "Adjusted", value: formatUnits(item.adjusted) },
                      { label: "Avg cost", value: formatMoney(item.avg_cost, currency) },
                      { label: "Est. value", value: formatMoney(item.estimated_value, currency) },
                    ].map((m) => (
                      <div key={m.label}>
                        <dt className="label-xs">{m.label}</dt>
                        <dd className="num mt-0.5 text-sm font-medium">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        models={inventory.map((i) => i.model)}
      />
      <ModelDetail model={detail} inventory={inventory} onClose={() => setDetail(null)} />
    </div>
  );
}

function AdjustDialog({
  open,
  onOpenChange,
  models,
  presetModel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  models: string[];
  presetModel?: string;
}) {
  const saveAdjustment = useStockStore((s) => s.saveAdjustment);
  const isReadOnly = useIsReadOnly();
  const [model, setModel] = useState(presetModel ?? "");
  const [type, setType] = useState<AdjustmentType>("Found Stock (+)");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error("Viewer mode: Stock adjustments are disabled.");
      return;
    }
    const next: Record<string, string> = {};
    const target = presetModel ?? model;
    if (!target) next.model = "Select a model";
    const qty = toNumber(quantity);
    if (!quantity.trim() || qty === 0) next.quantity = "Enter a quantity";
    else if (!Number.isInteger(qty)) next.quantity = "Quantity must be a whole number";
    else if (type !== "Correction" && qty < 0) next.quantity = "Enter a positive number";
    if (!reason.trim()) next.reason = "Reason is required";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fill required fields");
      return;
    }
    const signed =
      type === "Damaged (-)" || type === "Lost (-)"
        ? -Math.abs(qty)
        : type === "Found Stock (+)"
          ? Math.abs(qty)
          : qty;
    await saveAdjustment({ date, model: target, quantity: signed, type, reason });
    toast.success("Stock adjustment saved!");
    setModel(presetModel ?? "");
    setQuantity("");
    setReason("");
    setType("Found Stock (+)");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Corrections for found, damaged or lost inventory. Every adjustment is logged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Model" htmlFor="adj-model" required error={errors.model}>
            <input
              id="adj-model"
              list="adj-models"
              className={inputClass}
              value={presetModel ?? model}
              disabled={Boolean(presetModel)}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model name"
            />
            <datalist id="adj-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>

          <Field label="Adjustment type" htmlFor="adj-type" required>
            <select
              id="adj-type"
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as AdjustmentType)}
            >
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Quantity"
            htmlFor="adj-qty"
            required
            error={errors.quantity}
            hint={
              type === "Correction"
                ? "Use a negative number to reduce stock"
                : type === "Found Stock (+)"
                  ? "Added to stock"
                  : "Automatically deducted from stock"
            }
          >
            <input
              id="adj-qty"
              type="number"
              inputMode="numeric"
              step="1"
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </Field>

          <Field label="Date" htmlFor="adj-date" required>
            <input
              id="adj-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Reason" htmlFor="adj-reason" required error={errors.reason}>
            <input
              id="adj-reason"
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is the stock changing?"
            />
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className={btnPrimary}>
              Save adjustment
            </button>
            <button type="button" className={btnOutline} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModelDetail({
  model,
  inventory,
  onClose,
}: {
  model: string | null;
  inventory: InventoryItem[];
  onClose: () => void;
}) {
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const adjustments = useStockStore((s) => s.adjustments);
  const currency = useCurrency();
  const deletePurchase = useStockStore((s) => s.deletePurchase);
  const deleteSale = useStockStore((s) => s.deleteSale);
  const deleteAdjustment = useStockStore((s) => s.deleteAdjustment);
  const isReadOnly = useIsReadOnly();

  const item = inventory.find((i) => i.model === model);

  const [pendingDelete, setPendingDelete] = useState<{
    kind: "BUY" | "SELL" | "ADJUSTMENT";
    id: string;
    model: string;
  } | null>(null);

  const timeline = useMemo(() => {
    if (!model) return [];
    const rows = [
      ...purchases
        .filter((p) => p.model === model)
        .map((p) => ({
          id: p.record_id,
          kind: "BUY" as const,
          date: p.date,
          at: p.created_at,
          qty: p.quantity,
          amount: p.total_cost,
          note: p.supplier || p.remarks,
        })),
      ...sales
        .filter((s) => s.model === model)
        .map((s) => ({
          id: s.record_id,
          kind: "SELL" as const,
          date: s.date,
          at: s.created_at,
          qty: s.quantity,
          amount: s.total_sale,
          note: s.customer || s.remarks,
        })),
      ...adjustments
        .filter((a) => a.model === model)
        .map((a) => ({
          id: a.record_id,
          kind: "ADJUSTMENT" as const,
          date: a.date,
          at: a.created_at,
          qty: a.quantity,
          amount: 0,
          note: `${a.type} · ${a.reason}`,
        })),
    ];
    return rows.sort(
      (a, b) => b.date.localeCompare(a.date) || (b.at ?? "").localeCompare(a.at ?? ""),
    );
  }, [model, purchases, sales, adjustments]);

  const confirmDelete = async () => {
    if (isReadOnly || !pendingDelete) return;
    const { kind, id } = pendingDelete;
    if (kind === "BUY") await deletePurchase(id);
    else if (kind === "SELL") await deleteSale(id);
    else await deleteAdjustment(id);
    toast.success(`${kind} deleted`);
    setPendingDelete(null);
  };

  return (
    <>
      <Dialog open={Boolean(model && item)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{model}</DialogTitle>
            <DialogDescription>Full stock and money position for this model.</DialogDescription>
          </DialogHeader>
          {item ? (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: "Remaining stock", value: `${formatUnits(item.remaining)} units` },
                  { label: "Total bought", value: formatUnits(item.bought) },
                  { label: "Total sold", value: formatUnits(item.sold) },
                  { label: "Adjustments", value: formatUnits(item.adjusted) },
                  { label: "Average buy price", value: formatMoney(item.avg_cost, currency) },
                  {
                    label: "Latest buy price",
                    value: formatMoney(item.latest_buy_price, currency),
                  },
                  {
                    label: "Latest sell price",
                    value: formatMoney(item.latest_sell_price, currency),
                  },
                  {
                    label: "Total investment",
                    value: formatMoney(item.total_investment, currency),
                  },
                  { label: "Total sales", value: formatMoney(item.total_sales, currency) },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border bg-elevated p-3">
                    <dt className="label-xs">{m.label}</dt>
                    <dd className="num mt-1 text-sm font-semibold">{m.value}</dd>
                  </div>
                ))}
                <div className="col-span-2 rounded-lg border border-border bg-elevated p-3 sm:col-span-3">
                  <dt className="label-xs">Gross profit</dt>
                  <dd
                    className={cn(
                      "num mt-1 text-lg font-semibold",
                      item.gross_profit >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {item.gross_profit >= 0 ? "▲ " : "▼ "}
                    {formatMoney(item.gross_profit, currency)}
                  </dd>
                </div>
              </dl>

              <h3 className="mt-2 text-sm font-semibold">Transaction timeline</h3>
              <ul className="divide-y divide-border">
                {timeline.map((t) => (
                  <li
                    key={`${t.kind}-${t.id}`}
                    className="flex items-start justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <StatusPill
                          tone={t.kind === "BUY" ? "info" : t.kind === "SELL" ? "success" : "muted"}
                        >
                          {t.kind}
                        </StatusPill>{" "}
                        <span className="num text-xs text-muted-foreground">{t.id}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(t.date)} · {t.note || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="num text-sm font-semibold">
                          {t.kind === "SELL" ? "-" : t.kind === "BUY" ? "+" : t.qty >= 0 ? "+" : ""}
                          {formatUnits(Math.abs(t.qty))} units
                        </p>
                        {t.kind !== "ADJUSTMENT" ? (
                          <p className="num text-xs text-muted-foreground">
                            {formatMoney(t.amount, currency)}
                          </p>
                        ) : (
                          <p className="num text-xs text-muted-foreground">
                            {formatDateTime(t.at)}
                          </p>
                        )}
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          className={btnIcon}
                          aria-label={`Delete ${t.kind.toLowerCase()} ${t.id}`}
                          onClick={() => setPendingDelete({ kind: t.kind, id: t.id, model: model! })}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete this ${pendingDelete?.kind?.toLowerCase()}?`}
        description={
          pendingDelete?.kind === "SELL"
            ? "Stock will be restored and profit figures recalculated. This cannot be undone."
            : pendingDelete?.kind === "BUY"
              ? "This purchase will be removed permanently and your stock, investment and profit figures will be recalculated."
              : "This adjustment will be removed permanently and your stock figures will be recalculated."
        }
        confirmLabel={`Delete ${pendingDelete?.kind?.toLowerCase()}`}
        onConfirm={confirmDelete}
      />
    </>
  );
}
