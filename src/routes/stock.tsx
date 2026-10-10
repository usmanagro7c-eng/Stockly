import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Plus, SlidersHorizontal, Trash2, ArrowUpDown, ChevronRight, AlertTriangle, Layers, Download, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ComboboxSelect, type ComboboxOption } from "@/components/common/ComboboxSelect";
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
import { exportStockInventoryExcel } from "@/services/export-reports";
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
  const threshold = useStockStore((s) => s.settings.low_stock_threshold);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "LOW" | "OUT">("ALL");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPresetModel, setAdjustPresetModel] = useState<string | undefined>(undefined);
  const [detail, setDetail] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return inventory.filter((i) => {
      const matchesSearch = !q || i.model.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filterMode === "LOW") return i.status === "LOW STOCK";
      if (filterMode === "OUT") return i.status === "OUT OF STOCK";
      return true;
    });
  }, [inventory, debounced, filterMode]);

  const totalValue = filtered.reduce((t, i) => t + i.estimated_value, 0);
  const totalUnits = filtered.reduce((t, i) => t + i.remaining, 0);
  const lowCount = inventory.filter((i) => i.status === "LOW STOCK" || i.status === "OUT OF STOCK").length;

  const handleOpenAdjust = (preset?: string) => {
    setAdjustPresetModel(preset);
    setAdjustOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Inventory"
        subtitle="On-hand inventory & valuation."
        action={
          <div className="flex w-full sm:w-auto items-center gap-2">
            <button
              type="button"
              className={cn(btnOutline, "flex-1 sm:flex-initial tap-active")}
              onClick={() => {
                exportStockInventoryExcel(inventory, currency, threshold);
                toast.success("Stock Inventory Excel downloaded!");
              }}
            >
              <Download className="size-4" aria-hidden /> Export Excel
            </button>
            {!isReadOnly && (
              <button
                type="button"
                className={cn(btnPrimary, "flex-1 sm:flex-initial tap-active")}
                onClick={() => handleOpenAdjust()}
              >
                <Plus className="size-4" aria-hidden /> Adjust Stock
              </button>
            )}
          </div>
        }
      />

      {/* Stock Summary Mini-KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-elevated/40 p-3.5 sm:p-4">
          <p className="label-xs text-muted-foreground font-semibold">Stock Valuation</p>
          <p className="num mt-1 text-lg sm:text-2xl font-bold text-foreground truncate">
            {formatMoney(totalValue, currency)}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">{filtered.length} models listed</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-elevated/40 p-3.5 sm:p-4">
          <p className="label-xs text-muted-foreground font-semibold">Remaining Units</p>
          <p className="num mt-1 text-lg sm:text-2xl font-bold text-foreground">
            {formatUnits(totalUnits)}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">On-hand count</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-elevated/40 p-3.5 sm:p-4">
          <p className="label-xs text-muted-foreground font-semibold">Healthy Models</p>
          <p className="num mt-1 text-lg sm:text-2xl font-bold text-emerald-400">
            {inventory.filter((i) => i.status === "IN STOCK").length}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">Normal level</p>
        </div>

        <div className={cn("rounded-2xl border p-3.5 sm:p-4", lowCount > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-border/80 bg-elevated/40")}>
          <p className="label-xs text-muted-foreground font-semibold">Low / Out of Stock</p>
          <p className={cn("num mt-1 text-lg sm:text-2xl font-bold", lowCount > 0 ? "text-amber-400" : "text-muted-foreground")}>
            {lowCount}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">Alert threshold: {threshold}</p>
        </div>
      </div>

      <Panel className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchField
              label="Search stock"
              value={search}
              onChange={setSearch}
              placeholder="Search by model name..."
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterMode("ALL")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                filterMode === "ALL"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              All ({inventory.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("LOW")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                filterMode === "LOW"
                  ? "bg-amber-500 text-amber-950 font-bold shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              Low Stock
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("OUT")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap tap-active",
                filterMode === "OUT"
                  ? "bg-destructive text-destructive-foreground shadow-xs"
                  : "bg-elevated/70 text-muted-foreground hover:bg-elevated hover:text-foreground",
              )}
            >
              Out of Stock
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No stock models found"
            description="Buy new inventory or clear active filters to inspect stock levels."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) => {
              const bought = Math.max(item.bought, 1);
              const remainingPct = Math.min(100, Math.max(0, (item.remaining / bought) * 100));

              return (
                <li
                  key={item.model}
                  className="rounded-2xl border border-border/80 bg-elevated/60 p-4 transition-all hover:bg-elevated/90 hover:border-border shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title and Status Pill */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setDetail(item.model)}
                          className="text-left font-bold text-foreground text-base hover:text-primary transition-colors truncate block"
                        >
                          {item.model}
                        </button>
                        <p className="num text-xs text-muted-foreground mt-0.5">
                          Avg Cost: {formatMoney(item.avg_cost, currency)}
                        </p>
                      </div>
                      <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
                    </div>

                    {/* Stock Health Progress Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">On-hand level</span>
                        <span className="font-bold num text-foreground">
                          {formatUnits(item.remaining)} / {formatUnits(item.bought)} units
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            item.remaining <= 0
                              ? "bg-destructive"
                              : item.status === "LOW STOCK"
                                ? "bg-amber-400"
                                : "bg-primary",
                          )}
                          style={{ width: `${remainingPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Metrics Grid */}
                    <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-card/60 p-2.5 text-center">
                      <div>
                        <p className="label-xs text-[10px] text-muted-foreground/80">Sold</p>
                        <p className="num font-semibold text-xs text-foreground mt-0.5">
                          {formatUnits(item.sold)}
                        </p>
                      </div>
                      <div>
                        <p className="label-xs text-[10px] text-muted-foreground/80">Est. Value</p>
                        <p className="num font-semibold text-xs text-foreground mt-0.5 truncate">
                          {formatMoney(item.estimated_value, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="label-xs text-[10px] text-muted-foreground/80">Profit</p>
                        <p className={cn("num font-semibold text-xs mt-0.5 truncate", item.gross_profit >= 0 ? "text-success" : "text-destructive")}>
                          {formatMoney(item.gross_profit, currency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDetail(item.model)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span>Full Timeline & Breakdown</span>
                      <ChevronRight className="size-3.5" />
                    </button>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAdjust(item.model)}
                          className="rounded-lg border border-border/80 bg-elevated px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all"
                        >
                          Adjust
                        </button>
                        <Link
                          to="/buy"
                          className="rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/25 active:scale-95 transition-all"
                        >
                          Restock
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        models={inventory.map((i) => i.model)}
        presetModel={adjustPresetModel}
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
  const inventory = useInventory();
  const isReadOnly = useIsReadOnly();
  const [model, setModel] = useState(presetModel ?? "");
  const [type, setType] = useState<AdjustmentType>("Found Stock (+)");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const modelOptions = useMemo<ComboboxOption[]>(() => {
    return models.map((m) => {
      const inv = inventory.find((i) => i.model === m);
      return {
        value: m,
        label: m,
        icon: Package,
        sublabel: inv ? `Current: ${formatUnits(inv.remaining)} units` : undefined,
        badge: inv ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {formatUnits(inv.remaining)} in stock
          </span>
        ) : undefined,
      };
    });
  }, [models, inventory]);

  const typeOptions = useMemo<ComboboxOption[]>(() => {
    return ADJUSTMENT_TYPES.map((t) => {
      const isNegative = t.includes("(-)");
      const isPositive = t.includes("(+)");
      return {
        value: t,
        label: t,
        badge: (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border",
              isNegative
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : isPositive
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-primary/15 text-primary border-primary/30",
            )}
          >
            {isNegative ? "Deduct" : isPositive ? "Add" : "Correction"}
          </span>
        ),
      };
    });
  }, []);

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
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-3xl p-6 border-border/80 bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Adjust Stock Units</DialogTitle>
          <DialogDescription>
            Record inventory corrections, found items, damages or write-offs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 mt-2">
          <Field label="Model" htmlFor="adj-model" required error={errors.model}>
            <ComboboxSelect
              id="adj-model"
              value={presetModel ?? model}
              disabled={Boolean(presetModel)}
              onChange={(val) => setModel(val)}
              options={modelOptions}
              placeholder="Search or enter model..."
              searchPlaceholder="Type model name..."
              allowCustom={true}
              customActionLabel={(txt) => `+ Adjust "${txt}"`}
            />
          </Field>

          <Field label="Adjustment Type" htmlFor="adj-type" required>
            <ComboboxSelect
              id="adj-type"
              value={type}
              onChange={(val) => setType(val as AdjustmentType)}
              options={typeOptions}
              placeholder="Select adjustment type..."
              searchPlaceholder="Filter adjustment types..."
            />
          </Field>

          <Field
            label="Quantity"
            htmlFor="adj-qty"
            required
            error={errors.quantity}
            hint={
              type === "Correction"
                ? "Use negative to reduce stock, positive to increase"
                : type === "Found Stock (+)"
                  ? "Added directly to inventory"
                  : "Deducted from inventory"
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

          <Field label="Reason / Audit Note" htmlFor="adj-reason" required error={errors.reason}>
            <input
              id="adj-reason"
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Broken in storage, Count mismatch"
            />
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row pt-2">
            <button type="submit" className={btnPrimary}>
              Save Adjustment
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
    toast.success(`${kind} record deleted`);
    setPendingDelete(null);
  };

  return (
    <>
      <Dialog open={Boolean(model && item)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-3xl p-6 border-border/80 bg-card shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-xl font-bold">{model}</DialogTitle>
              {item && <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>}
            </div>
            <DialogDescription>Full financial and quantity breakdown for this model.</DialogDescription>
          </DialogHeader>

          {item ? (
            <div className="space-y-4 mt-2">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: "Remaining Stock", value: `${formatUnits(item.remaining)} units` },
                  { label: "Total Bought", value: `${formatUnits(item.bought)} units` },
                  { label: "Total Sold", value: `${formatUnits(item.sold)} units` },
                  { label: "Adjustments", value: `${formatUnits(item.adjusted)} units` },
                  { label: "Average Buy Price", value: formatMoney(item.avg_cost, currency) },
                  {
                    label: "Latest Buy Price",
                    value: formatMoney(item.latest_buy_price, currency),
                  },
                  {
                    label: "Latest Sell Price",
                    value: formatMoney(item.latest_sell_price, currency),
                  },
                  {
                    label: "Total Investment",
                    value: formatMoney(item.total_investment, currency),
                  },
                  { label: "Total Sales", value: formatMoney(item.total_sales, currency) },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-border/70 bg-elevated/60 p-3">
                    <dt className="label-xs text-[10px] text-muted-foreground/80">{m.label}</dt>
                    <dd className="num mt-1 text-sm font-bold text-foreground">{m.value}</dd>
                  </div>
                ))}
                <div className="col-span-2 rounded-xl border border-border/70 bg-elevated/70 p-3 sm:col-span-3">
                  <dt className="label-xs text-muted-foreground">Gross Profit Earned</dt>
                  <dd
                    className={cn(
                      "num mt-1 text-xl font-bold",
                      item.gross_profit >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {item.gross_profit >= 0 ? "+ " : "- "}
                    {formatMoney(Math.abs(item.gross_profit), currency)}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="text-sm font-bold text-foreground mb-2.5">Timeline History</h3>
                <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-elevated/40 p-2">
                  {timeline.map((t) => (
                    <li
                      key={`${t.kind}-${t.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 px-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusPill
                            tone={t.kind === "BUY" ? "info" : t.kind === "SELL" ? "success" : "muted"}
                          >
                            {t.kind}
                          </StatusPill>
                          <span className="num text-xs text-muted-foreground font-mono">{t.id}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {formatDate(t.date)} · {t.note || "—"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="num text-sm font-bold text-foreground">
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
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete this ${pendingDelete?.kind?.toLowerCase()} record?`}
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
