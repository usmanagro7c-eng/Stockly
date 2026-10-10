import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Eye,
  HandCoins,
  Landmark,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
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
import { useCurrency, useIsReadOnly, useStockStore } from "@/store/stockStore";
import { INVESTMENT_TYPES, type Investment, type InvestmentType } from "@/types";
import { formatDate, formatMoney, todayISO, toNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Investments & Capital — Stockly" },
      {
        name: "description",
        content: "Track investor capital injection, partner contributions, borrowings, and withdrawals.",
      },
      { property: "og:title", content: "Investments & Capital — Stockly" },
      { property: "og:description", content: "Track capital injections, partner contributions, loans, and drawings." },
    ],
  }),
  component: InvestmentsPage,
});

interface FormState {
  investor: string;
  amount: string;
  type: InvestmentType;
  date: string;
  remarks: string;
}

const emptyForm = (): FormState => ({
  investor: "",
  amount: "",
  type: "Capital Injection",
  date: todayISO(),
  remarks: "",
});

function getTypeBadge(type: InvestmentType) {
  switch (type) {
    case "Capital Injection":
      return {
        bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
        icon: TrendingUp,
        label: "Capital In",
        isCredit: true,
      };
    case "Partner Contribution":
      return {
        bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
        icon: Users,
        label: "Partner",
        isCredit: true,
      };
    case "Loan / Borrowing":
      return {
        bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
        icon: Coins,
        label: "Loan",
        isCredit: true,
      };
    case "Drawings / Withdrawal":
      return {
        bg: "bg-rose-500/10 text-rose-400 border-rose-500/25",
        icon: ArrowUpRight,
        label: "Withdrawal",
        isCredit: false,
      };
  }
}

function InvestmentsPage() {
  const investments = useStockStore((s) => s.investments);
  const saveInvestment = useStockStore((s) => s.saveInvestment);
  const deleteInvestment = useStockStore((s) => s.deleteInvestment);
  const currency = useCurrency();
  const isReadOnly = useIsReadOnly();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const setField = (key: keyof FormState, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const reset = () => {
    setForm(emptyForm());
    setErrors({});
    setEditingId(null);
  };

  const quickAmounts = [10000, 50000, 100000, 500000];

  const handleAddAmount = (val: number) => {
    const current = toNumber(form.amount);
    setField("amount", String(current + val));
  };

  // Distinct investor names for autocomplete
  const existingInvestors = useMemo(() => {
    const set = new Set<string>();
    investments.forEach((i) => {
      if (i.investor?.trim()) set.add(i.investor.trim());
    });
    return Array.from(set).sort();
  }, [investments]);

  const investorOptions = useMemo<ComboboxOption[]>(() => {
    return existingInvestors.map((name) => ({
      value: name,
      label: name,
      icon: Users,
    }));
  }, [existingInvestors]);

  // Overall Financial Calculations
  const metrics = useMemo(() => {
    let totalInjected = 0;
    let totalPartner = 0;
    let totalLoans = 0;
    let totalDrawings = 0;

    investments.forEach((inv) => {
      const amt = Number(inv.amount) || 0;
      if (inv.type === "Capital Injection") totalInjected += amt;
      else if (inv.type === "Partner Contribution") totalPartner += amt;
      else if (inv.type === "Loan / Borrowing") totalLoans += amt;
      else if (inv.type === "Drawings / Withdrawal") totalDrawings += amt;
    });

    const grossCapital = totalInjected + totalPartner;
    const netCapital = grossCapital + totalLoans - totalDrawings;

    return {
      grossCapital,
      totalInjected,
      totalPartner,
      totalLoans,
      totalDrawings,
      netCapital,
      investorCount: existingInvestors.length,
    };
  }, [investments, existingInvestors]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error("Viewer mode: You have read-only access and cannot save investment entries.");
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (!form.investor.trim()) nextErrors.investor = "Investor / Partner name is required";
    const amount = toNumber(form.amount);
    if (!form.amount.trim() || amount <= 0) nextErrors.amount = "Enter an amount greater than 0";
    if (!form.date) nextErrors.date = "Date is required";
    if (!form.type) nextErrors.type = "Select investment type";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill in required fields correctly");
      return;
    }

    try {
      await saveInvestment(
        {
          investor: form.investor.trim(),
          amount,
          type: form.type,
          date: form.date,
          remarks: form.remarks.trim(),
        },
        editingId ?? undefined,
      );
      toast.success(editingId ? "Investment updated!" : "Investment recorded!");
      reset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save investment");
    }
  };

  const startEdit = (id: string) => {
    if (isReadOnly) {
      toast.error("Viewer mode: Editing is disabled.");
      return;
    }
    const row = investments.find((i) => i.record_id === id);
    if (!row) return;
    setEditingId(id);
    setForm({
      investor: row.investor,
      amount: String(row.amount),
      type: row.type,
      date: row.date,
      remarks: row.remarks || "",
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (isReadOnly || !pendingDelete) return;
    try {
      await deleteInvestment(pendingDelete);
      if (editingId === pendingDelete) reset();
      setPendingDelete(null);
      toast.success("Investment record deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete investment");
    }
  };

  // Filtered List
  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return investments
      .filter((inv) => {
        const matchesQuery =
          !q ||
          inv.investor.toLowerCase().includes(q) ||
          inv.remarks.toLowerCase().includes(q) ||
          inv.record_id.toLowerCase().includes(q) ||
          inv.type.toLowerCase().includes(q);

        const matchesType = selectedType === "ALL" || inv.type === selectedType;

        return matchesQuery && matchesType;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [investments, debounced, selectedType]);

  const filteredNet = useMemo(() => {
    return filtered.reduce((acc, inv) => {
      const amt = Number(inv.amount) || 0;
      return inv.type === "Drawings / Withdrawal" ? acc - amt : acc + amt;
    }, 0);
  }, [filtered]);

  const { visible, remaining, loadMore } = useListPaging(filtered, [debounced, selectedType]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments & Capital"
        subtitle="Manage investor capital injection, partner contributions, borrowings, and withdrawals."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Landmark className="size-3" />
            {investments.length} Records
          </span>
        }
      />

      {/* 4 Modern KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net Capital */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 via-card/60 to-background p-4.5 shadow-sm transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Working Capital</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Landmark className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatMoney(metrics.netCapital, currency)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>Injected + Loans − Drawings</span>
          </div>
        </div>

        {/* Gross Capital Injected */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 via-card/60 to-background p-4.5 shadow-sm transition-all hover:border-cyan-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Capital & Partners</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-cyan-400 sm:text-2xl">
            +{formatMoney(metrics.grossCapital, currency)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>{metrics.investorCount} partners / investors</span>
          </div>
        </div>

        {/* Loans / Borrowings */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 via-card/60 to-background p-4.5 shadow-sm transition-all hover:border-indigo-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Loans / Borrowings</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-indigo-400 sm:text-2xl">
            {formatMoney(metrics.totalLoans, currency)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>External liabilities</span>
          </div>
        </div>

        {/* Drawings / Withdrawals */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 via-card/60 to-background p-4.5 shadow-sm transition-all hover:border-rose-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Partner Withdrawals</span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-rose-400 sm:text-2xl">
            -{formatMoney(metrics.totalDrawings, currency)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>Drawn capital / profit payout</span>
          </div>
        </div>
      </div>

      {/* Record / Edit Form */}
      <Panel>
        <SectionTitle
          left={
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            </div>
          }
        >
          {editingId ? "Edit Investment Entry" : "Record New Investment / Drawing"}
        </SectionTitle>

        <form onSubmit={submit} className="mt-4 space-y-4">
          {isReadOnly && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-400">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span>Viewer Mode: You have read-only access to this Google Sheet. Adding or modifying records is disabled.</span>
            </div>
          )}

          {/* Investment Type Selector Chips */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Transaction Type <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INVESTMENT_TYPES.map((t) => {
                const badge = getTypeBadge(t);
                const Icon = badge.icon;
                const active = form.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setField("type", t)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all text-left",
                      active
                        ? "border-primary/50 bg-primary/15 text-primary shadow-sm"
                        : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-lg border",
                        badge.bg,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <span className="truncate">{t}</span>
                  </button>
                );
              })}
            </div>
            {errors.type && <p className="mt-1 text-xs text-destructive">{errors.type}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Investor / Partner Name */}
            <Field
              label="Investor / Partner Name"
              htmlFor="inv-name"
              required
              error={errors.investor}
              hint="Name of the person, partner, or bank"
            >
              <ComboboxSelect
                id="inv-name"
                value={form.investor}
                onChange={(val) => setField("investor", val)}
                options={investorOptions}
                placeholder="Select or enter partner / investor..."
                searchPlaceholder="Search or type name..."
                allowCustom={true}
                customActionLabel={(txt) => `+ Use "${txt}" as investor`}
                disabled={isReadOnly}
              />
            </Field>

            {/* Amount with Quick Chips */}
            <Field
              label={`Amount (${currency})`}
              htmlFor="inv-amount"
              required
              error={errors.amount}
            >
              <div className="space-y-1.5">
                <input
                  id="inv-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  placeholder="0.00"
                  disabled={isReadOnly}
                />
                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">Quick add:</span>
                    {quickAmounts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleAddAmount(q)}
                        className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted active:scale-95 transition-all"
                      >
                        +{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            {/* Date */}
            <Field label="Transaction Date" htmlFor="inv-date" required error={errors.date}>
              <input
                id="inv-date"
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                disabled={isReadOnly}
              />
            </Field>

            {/* Remarks */}
            <Field label="Remarks / Purpose" htmlFor="inv-remarks">
              <input
                id="inv-remarks"
                className={inputClass}
                value={form.remarks}
                onChange={(e) => setField("remarks", e.target.value)}
                placeholder="e.g. Initial capital, Shop expansion, Monthly drawing"
                disabled={isReadOnly}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <button
              type="submit"
              className={cn(btnPrimary, "w-full sm:w-auto", isReadOnly && "cursor-not-allowed opacity-50")}
              disabled={isReadOnly}
            >
              <HandCoins className="size-4" aria-hidden />
              {editingId ? "Update Investment Record" : "Save Investment Entry"}
            </button>
            {editingId && (
              <button type="button" className={btnOutline} onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Panel>

      {/* History and List Panel */}
      <Panel className="space-y-4">
        <SectionTitle
          right={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtered Net:</span>
              <span
                className={cn(
                  "num text-sm font-bold",
                  filteredNet >= 0 ? "text-emerald-400" : "text-destructive",
                )}
              >
                {filteredNet >= 0 ? "+" : ""}
                {formatMoney(filteredNet, currency)}
              </span>
            </div>
          }
        >
          Investment History
        </SectionTitle>

        {/* Filter and Search Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <SearchField
              label="Search investments"
              value={search}
              onChange={setSearch}
              placeholder="Search investor, remarks..."
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedType("ALL")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                selectedType === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              All ({investments.length})
            </button>
            {INVESTMENT_TYPES.map((t) => {
              const count = investments.filter((i) => i.type === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                    selectedType === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.split(" ")[0]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Record Cards & Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={debounced || selectedType !== "ALL" ? "No matches found" : "No investments recorded yet"}
            description={
              debounced || selectedType !== "ALL"
                ? "Try adjusting your search keywords or category filters."
                : "Add your first capital injection, partner investment, or loan above."
            }
          />
        ) : (
          <div className="space-y-2">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Investor</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visible.map((inv) => {
                    const badge = getTypeBadge(inv.type);
                    const Icon = badge.icon;
                    return (
                      <tr key={inv.record_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(inv.date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{inv.investor}</span>
                            <span className="text-[10px] text-muted-foreground/60">{inv.record_id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              badge.bg,
                            )}
                          >
                            <Icon className="size-3" />
                            {inv.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                          {inv.remarks || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          <span
                            className={cn(
                              "num",
                              badge.isCredit ? "text-emerald-400" : "text-rose-400",
                            )}
                          >
                            {badge.isCredit ? "+" : "-"}
                            {formatMoney(inv.amount, currency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(inv.record_id)}
                              className={cn(btnIcon, "hover:text-primary")}
                              title="Edit entry"
                              disabled={isReadOnly}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(inv.record_id)}
                              className={cn(btnIcon, "hover:text-destructive")}
                              title="Delete entry"
                              disabled={isReadOnly}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Compact Card View */}
            <div className="grid gap-2.5 md:hidden">
              {visible.map((inv) => {
                const badge = getTypeBadge(inv.type);
                const Icon = badge.icon;
                return (
                  <div
                    key={inv.record_id}
                    className="relative rounded-xl border border-border/70 bg-card/60 p-3.5 transition-all hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{inv.investor}</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.2 text-[10px] font-semibold",
                              badge.bg,
                            )}
                          >
                            <Icon className="size-2.5" />
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.date)} • {inv.record_id}
                        </p>
                      </div>

                      <div className="text-right">
                        <div
                          className={cn(
                            "num text-sm font-bold",
                            badge.isCredit ? "text-emerald-400" : "text-rose-400",
                          )}
                        >
                          {badge.isCredit ? "+" : "-"}
                          {formatMoney(inv.amount, currency)}
                        </div>
                      </div>
                    </div>

                    {inv.remarks && (
                      <p className="mt-2 text-xs text-muted-foreground/90 bg-muted/40 rounded-lg p-2 border border-border/40">
                        {inv.remarks}
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center justify-end gap-1.5 border-t border-border/40 pt-2">
                      <button
                        type="button"
                        onClick={() => startEdit(inv.record_id)}
                        className={cn(btnOutline, "py-1 px-2.5 text-xs h-7")}
                        disabled={isReadOnly}
                      >
                        <Pencil className="size-3 mr-1" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(inv.record_id)}
                        className={cn(btnOutline, "py-1 px-2.5 text-xs h-7 text-destructive hover:bg-destructive/10")}
                        disabled={isReadOnly}
                      >
                        <Trash2 className="size-3 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <LoadMore
              shown={visible.length}
              total={filtered.length}
              remaining={remaining}
              onLoadMore={loadMore}
            />
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete Investment Record"
        description="Are you sure you want to delete this investment record? This change will also be synced to Google Sheets and recorded in Activity logs."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
