import { useMemo } from "react";
import { create } from "zustand";
import { repository, DEFAULT_SETTINGS } from "@/services/database/repository";
import { generateRecordId } from "@/services/ids";
import { buildInventory, computeMetrics } from "@/services/calculations";
import { syncManager, type SheetRole } from "@/services/sync-manager";
import type {
  Adjustment,
  ChangeAction,
  ChangeLog,
  ChangeSection,
  Expense,
  Investment,
  InvestmentType,
  Purchase,
  Sale,
  Settings,
} from "@/types";

interface State {
  ready: boolean;
  loading: boolean;
  locked: boolean;
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  adjustments: Adjustment[];
  changelogs: ChangeLog[];
  investments: Investment[];
  settings: Settings;
  sheetRole: SheetRole;

  init: () => Promise<void>;
  unlock: () => void;
  lock: () => void;

  savePurchase: (input: PurchaseInput, editingId?: string) => Promise<Purchase>;
  deletePurchase: (id: string) => Promise<void>;
  saveSale: (input: SaleInput, editingId?: string) => Promise<Sale>;
  deleteSale: (id: string) => Promise<void>;
  saveExpense: (input: ExpenseInput, editingId?: string) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  saveAdjustment: (input: AdjustmentInput) => Promise<Adjustment>;
  deleteAdjustment: (id: string) => Promise<void>;
  saveInvestment: (input: InvestmentInput, editingId?: string) => Promise<Investment>;
  deleteInvestment: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  importData: (
    data: {
      purchases: Purchase[];
      sales: Sale[];
      expenses: Expense[];
      adjustments: Adjustment[];
      changelogs: ChangeLog[];
      investments?: Investment[];
    },
    mode: "merge" | "replace",
  ) => Promise<void>;
  logExport: () => Promise<void>;
  connectGoogleSheet: (sheetId: string) => Promise<void>;
  /** `log` adds a changelog entry — off for automatic background syncs. */
  syncToGoogleSheets: (log?: boolean) => Promise<void>;
  syncFromGoogleSheets: (log?: boolean) => Promise<void>;
  refreshSheetPermission: () => Promise<void>;
}

export interface PurchaseInput {
  date: string;
  model: string;
  quantity: number;
  buying_price: number;
  supplier: string;
  remarks: string;
}
export interface SaleInput {
  date: string;
  model: string;
  quantity: number;
  selling_price: number;
  profit: number;
  customer: string;
  remarks: string;
}
export interface ExpenseInput {
  date: string;
  expense_type: string;
  amount: number;
  remarks: string;
}
export interface AdjustmentInput {
  date: string;
  model: string;
  quantity: number;
  type: Adjustment["type"];
  reason: string;
}
export interface InvestmentInput {
  date: string;
  investor: string;
  amount: number;
  type: InvestmentType;
  remarks: string;
}

export const useStockStore = create<State>((set, get) => ({
  ready: false,
  loading: false,
  locked: false,
  purchases: [],
  sales: [],
  expenses: [],
  adjustments: [],
  changelogs: [],
  investments: [],
  settings: { ...DEFAULT_SETTINGS },
  sheetRole: syncManager.getRole(),

  init: async () => {
    // Only skip when a previous attempt already succeeded. A stalled attempt
    // must stay retryable, so `loading` alone cannot gate the call.
    if (get().ready) return;
    if (get().loading) return;
    set({ loading: true });
    try {
      const data = await repository.loadAll();
      set({
        ...data,
        ready: true,
        loading: false,
        locked: Boolean(data.settings.pin_code_hash),
      });
    } catch (err) {
      console.error("Failed to load Stockly data", err);
      // Stay un-ready so AppGate can offer a retry rather than dropping the
      // user into an app with no data loaded.
      set({ loading: false });
    }
  },

  unlock: () => set({ locked: false }),
  lock: () => set({ locked: Boolean(get().settings.pin_code_hash) }),

  savePurchase: async (input, editingId) => {
    assertCanEdit();
    const { purchases, settings } = get();
    const now = new Date().toISOString();
    const existing = editingId ? purchases.find((p) => p.record_id === editingId) : undefined;
    const row: Purchase = {
      record_id:
        existing?.record_id ??
        generateRecordId(
          "BUY",
          purchases.map((p) => p.record_id),
        ),
      date: input.date,
      model: input.model.trim(),
      quantity: input.quantity,
      buying_price: input.buying_price,
      total_cost: input.quantity * input.buying_price,
      supplier: input.supplier.trim(),
      remarks: input.remarks.trim(),
      created_by: existing?.created_by ?? settings.user_name,
      created_at: existing?.created_at ?? now,
      updated_by: settings.user_name,
      updated_at: now,
    };
    await repository.purchases.put(row);
    set({
      purchases: existing
        ? purchases.map((p) => (p.record_id === row.record_id ? row : p))
        : [...purchases, row],
    });
    await addLog({
      action: existing ? "EDIT" : "ADD",
      section: "BUY",
      record_id: row.record_id,
      model: row.model,
      quantity: row.quantity,
      old_value: existing ? String(existing.total_cost) : "",
      new_value: String(row.total_cost),
      remarks: row.remarks,
    });
    syncManager.markDirty();
    return row;
  },

  deletePurchase: async (id) => {
    assertCanEdit();
    const { purchases } = get();
    const row = purchases.find((p) => p.record_id === id);
    await repository.purchases.remove(id);
    set({ purchases: purchases.filter((p) => p.record_id !== id) });
    if (row)
      await addLog({
        action: "DELETE",
        section: "BUY",
        record_id: id,
        model: row.model,
        quantity: row.quantity,
        old_value: String(row.total_cost),
        new_value: "",
        remarks: row.remarks,
      });
    syncManager.markDirty();
  },

  saveSale: async (input, editingId) => {
    assertCanEdit();
    const { sales, settings } = get();
    const now = new Date().toISOString();
    const existing = editingId ? sales.find((s) => s.record_id === editingId) : undefined;
    const row: Sale = {
      record_id:
        existing?.record_id ??
        generateRecordId(
          "SELL",
          sales.map((s) => s.record_id),
        ),
      date: input.date,
      model: input.model.trim(),
      quantity: input.quantity,
      selling_price: input.selling_price,
      total_sale: input.quantity * input.selling_price,
      profit: input.profit,
      customer: input.customer.trim(),
      remarks: input.remarks.trim(),
      created_by: existing?.created_by ?? settings.user_name,
      created_at: existing?.created_at ?? now,
      updated_by: settings.user_name,
      updated_at: now,
    };
    await repository.sales.put(row);
    set({
      sales: existing
        ? sales.map((s) => (s.record_id === row.record_id ? row : s))
        : [...sales, row],
    });
    await addLog({
      action: existing ? "EDIT" : "ADD",
      section: "SELL",
      record_id: row.record_id,
      model: row.model,
      quantity: row.quantity,
      old_value: existing ? String(existing.total_sale) : "",
      new_value: String(row.total_sale),
      remarks: row.remarks,
    });
    syncManager.markDirty();
    return row;
  },

  deleteSale: async (id) => {
    assertCanEdit();
    const { sales } = get();
    const row = sales.find((s) => s.record_id === id);
    await repository.sales.remove(id);
    set({ sales: sales.filter((s) => s.record_id !== id) });
    if (row)
      await addLog({
        action: "DELETE",
        section: "SELL",
        record_id: id,
        model: row.model,
        quantity: row.quantity,
        old_value: String(row.total_sale),
        new_value: "",
        remarks: "Stock restored",
      });
    syncManager.markDirty();
  },

  saveExpense: async (input, editingId) => {
    assertCanEdit();
    const { expenses, settings } = get();
    const now = new Date().toISOString();
    const existing = editingId ? expenses.find((e) => e.record_id === editingId) : undefined;
    const row: Expense = {
      record_id:
        existing?.record_id ??
        generateRecordId(
          "EXPENSE",
          expenses.map((e) => e.record_id),
        ),
      date: input.date,
      expense_type: input.expense_type,
      amount: input.amount,
      remarks: input.remarks.trim(),
      created_by: existing?.created_by ?? settings.user_name,
      created_at: existing?.created_at ?? now,
      updated_by: settings.user_name,
      updated_at: now,
    };
    await repository.expenses.put(row);
    set({
      expenses: existing
        ? expenses.map((e) => (e.record_id === row.record_id ? row : e))
        : [...expenses, row],
    });
    await addLog({
      action: existing ? "EDIT" : "ADD",
      section: "EXPENSE",
      record_id: row.record_id,
      model: row.expense_type,
      quantity: 0,
      old_value: existing ? String(existing.amount) : "",
      new_value: String(row.amount),
      remarks: row.remarks,
    });
    syncManager.markDirty();
    return row;
  },

  deleteExpense: async (id) => {
    assertCanEdit();
    const { expenses } = get();
    const row = expenses.find((e) => e.record_id === id);
    await repository.expenses.remove(id);
    set({ expenses: expenses.filter((e) => e.record_id !== id) });
    if (row)
      await addLog({
        action: "DELETE",
        section: "EXPENSE",
        record_id: id,
        model: row.expense_type,
        quantity: 0,
        old_value: String(row.amount),
        new_value: "",
        remarks: row.remarks,
      });
    syncManager.markDirty();
  },

  saveAdjustment: async (input) => {
    assertCanEdit();
    const { adjustments, settings } = get();
    const row: Adjustment = {
      record_id: generateRecordId(
        "ADJ",
        adjustments.map((a) => a.record_id),
      ),
      date: input.date,
      model: input.model.trim(),
      quantity: input.quantity,
      type: input.type,
      reason: input.reason.trim(),
      created_by: settings.user_name,
      created_at: new Date().toISOString(),
    };
    await repository.adjustments.put(row);
    set({ adjustments: [...adjustments, row] });
    await addLog({
      action: "ADD",
      section: "STOCK_ADJUSTMENT",
      record_id: row.record_id,
      model: row.model,
      quantity: row.quantity,
      old_value: "",
      new_value: row.type,
      remarks: row.reason,
    });
    syncManager.markDirty();
    return row;
  },

  deleteAdjustment: async (id) => {
    assertCanEdit();
    const { adjustments } = get();
    const row = adjustments.find((a) => a.record_id === id);
    await repository.adjustments.remove(id);
    set({ adjustments: adjustments.filter((a) => a.record_id !== id) });
    if (row)
      await addLog({
        action: "DELETE",
        section: "STOCK_ADJUSTMENT",
        record_id: id,
        model: row.model,
        quantity: row.quantity,
        old_value: row.type,
        new_value: "",
        remarks: row.reason,
      });
    syncManager.markDirty();
  },

  saveInvestment: async (input, editingId) => {
    assertCanEdit();
    const { investments, settings } = get();
    const now = new Date().toISOString();
    const existing = editingId ? investments.find((i) => i.record_id === editingId) : undefined;
    const row: Investment = {
      record_id:
        existing?.record_id ??
        generateRecordId(
          "INV",
          investments.map((i) => i.record_id),
        ),
      date: input.date,
      investor: input.investor.trim(),
      amount: input.amount,
      type: input.type,
      remarks: input.remarks.trim(),
      created_by: existing?.created_by ?? settings.user_name,
      created_at: existing?.created_at ?? now,
      updated_by: settings.user_name,
      updated_at: now,
    };
    await repository.investments.put(row);
    set({
      investments: existing
        ? investments.map((i) => (i.record_id === row.record_id ? row : i))
        : [...investments, row],
    });
    await addLog({
      action: existing ? "EDIT" : "ADD",
      section: "INVESTMENT",
      record_id: row.record_id,
      model: `${row.investor} (${row.type})`,
      quantity: 0,
      old_value: existing ? String(existing.amount) : "",
      new_value: String(row.amount),
      remarks: row.remarks,
    });
    syncManager.markDirty();
    return row;
  },

  deleteInvestment: async (id) => {
    assertCanEdit();
    const { investments } = get();
    const row = investments.find((i) => i.record_id === id);
    await repository.investments.remove(id);
    set({ investments: investments.filter((i) => i.record_id !== id) });
    if (row)
      await addLog({
        action: "DELETE",
        section: "INVESTMENT",
        record_id: id,
        model: `${row.investor} (${row.type})`,
        quantity: 0,
        old_value: String(row.amount),
        new_value: "",
        remarks: row.remarks,
      });
    syncManager.markDirty();
  },

  updateSettings: async (patch) => {
    const current = get().settings;
    let changed = false;
    for (const key of Object.keys(patch) as (keyof Settings)[]) {
      if (current[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    // A no-op patch must not create a new object: `settings` is subscribed to
    // app-wide, so a fresh identity re-renders every screen.
    if (!changed) return;

    const next = { ...current, ...patch };
    await repository.saveSettings(next);
    set({ settings: next, locked: get().locked && Boolean(next.pin_code_hash) });
  },

  importData: async (data, mode) => {
    assertCanEdit();
    if (mode === "replace") {
      await repository.replaceAll(data);
      set({
        purchases: data.purchases,
        sales: data.sales,
        expenses: data.expenses,
        adjustments: data.adjustments,
        changelogs: data.changelogs,
        investments: data.investments ?? [],
      });
    } else {
      await repository.mergeAll(data);
      const merge = <T extends object>(current: T[], incoming: T[], key: keyof T) => {
        const map = new Map(current.map((r) => [r[key], r]));
        incoming.forEach((r) => map.set(r[key], r));
        return Array.from(map.values());
      };
      const s = get();
      set({
        purchases: merge(s.purchases, data.purchases, "record_id"),
        sales: merge(s.sales, data.sales, "record_id"),
        expenses: merge(s.expenses, data.expenses, "record_id"),
        adjustments: merge(s.adjustments, data.adjustments, "record_id"),
        changelogs: merge(s.changelogs, data.changelogs, "change_id"),
        investments: merge(s.investments, data.investments ?? [], "record_id"),
      });
    }
    // An imported backup can carry a huge audit trail; trim it back down so
    // the Activity screen and every later sync stay fast.
    await pruneChangelogs(get().changelogs);
    await addLog({
      action: "IMPORT",
      section: "BUY",
      record_id: "-",
      model: "-",
      quantity: 0,
      old_value: "",
      new_value: mode.toUpperCase(),
      remarks: `${data.purchases.length + data.sales.length + data.expenses.length + data.adjustments.length} records imported`,
    });
  },

  logExport: async () => {
    await addLog({
      action: "EXPORT",
      section: "BUY",
      record_id: "-",
      model: "-",
      quantity: 0,
      old_value: "",
      new_value: "BACKUP",
      remarks: "Data exported",
    });
  },

  connectGoogleSheet: async (sheetId: string) => {
    await syncManager.setSheetId(sheetId);
    const role = await syncManager.detectPermission();
    set({ sheetRole: role });
    await get().updateSettings({
      linked_file_name: sheetId,
      last_sync_time: new Date().toISOString(),
    });
    if (role === "read") {
      await get().syncFromGoogleSheets(true);
    } else {
      await get().syncToGoogleSheets(true);
    }
  },


  refreshSheetPermission: async () => {
    if (!get().settings.linked_file_name && !syncManager.isConnected()) return;
    const role = await syncManager.detectPermission().catch(() => null);
    set({ sheetRole: role });
  },

  syncToGoogleSheets: async (log = true) => {
    const { purchases, sales } = get();
    await syncManager.syncToSheets();
    // syncToSheets touches last_sync_time in the DB; mirror it into the store
    // so the Settings screen does not keep showing a stale timestamp.
    const lastSync =
      typeof localStorage !== "undefined" ? localStorage.getItem("googleLastSync") : null;
    set({
      sheetRole: syncManager.getRole(),
      settings: {
        ...get().settings,
        last_sync_time: lastSync ?? new Date().toISOString(),
      },
    });
    if (log) {
      await addLog({
        action: "SYNC",
        section: "BUY",
        record_id: "-",
        model: "Google Sheet",
        quantity: 0,
        old_value: "",
        new_value: "EXPORT",
        remarks: `Synced ${purchases.length} purchases, ${sales.length} sales`,
      });
    }
  },

  syncFromGoogleSheets: async (log = true) => {
    // syncFromSheets already persists the merged dataset; use it directly
    // instead of re-reading every table out of IndexedDB a second time.
    const data = await syncManager.syncFromSheets();
    const role = syncManager.getRole();
    set({
      sheetRole: role,
      purchases: data.purchases,
      sales: data.sales,
      expenses: data.expenses,
      adjustments: data.adjustments,
      changelogs: data.changelogs,
      investments: data.investments,
      settings: data.settings,
    });
    if (log) {
      await addLog({
        action: "SYNC",
        section: "BUY",
        record_id: "-",
        model: "Google Sheet",
        quantity: 0,
        old_value: "",
        new_value: "IMPORT",
        remarks: "Synced from Google Sheet",
      });
    }
  },
}));

/**
 * Hard ceiling on the changelog table. The audit trail is useful, but an
 * unbounded log is re-read, re-merged and re-rendered on every sync and every
 * visit to the Activity screen — that unbounded growth is what made the app
 * progressively slower until it appeared to freeze.
 */
const MAX_CHANGELOG_ROWS = 5000;

/** Newest `MAX_CHANGELOG_ROWS` entries, oldest-first. Exported for tests. */
export function capChangelogs(rows: ChangeLog[]): { kept: ChangeLog[]; removed: string[] } {
  if (rows.length <= MAX_CHANGELOG_ROWS) return { kept: rows, removed: [] };
  const sorted = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const cut = sorted.length - MAX_CHANGELOG_ROWS;
  return {
    kept: sorted.slice(cut),
    removed: sorted.slice(0, cut).map((c) => c.change_id),
  };
}

async function pruneChangelogs(rows: ChangeLog[]): Promise<ChangeLog[]> {
  const { kept, removed } = capChangelogs(rows);
  if (removed.length) await repository.changelogs.remove(removed);
  return kept;
}

async function addLog(entry: Omit<ChangeLog, "change_id" | "timestamp" | "user" | "device_id">) {
  const { changelogs, settings } = useStockStore.getState();
  const row: ChangeLog = {
    change_id: generateRecordId(
      "CHANGE",
      changelogs.map((c) => c.change_id),
    ),
    timestamp: new Date().toISOString(),
    user: settings.user_name || "Unknown",
    device_id: settings.device_id,
    ...entry,
  };
  await repository.changelogs.put(row);
  useStockStore.setState({ changelogs: await pruneChangelogs([...changelogs, row]) });
}

/** Throw when the linked sheet is read-only (Viewer). */
function assertCanEdit(): void {
  if (useStockStore.getState().sheetRole === "read") {
    throw new Error("You have read-only access to this Google Sheet");
  }
}

/* ---------- derived selectors ---------- */

/**
 * `buildInventory` is O(models x rows), so it must never run during render.
 * Memoizing keeps the array identity stable across renders, which is what
 * lets every downstream `useMemo` in the route screens actually memoize.
 */
export function useInventory() {
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const adjustments = useStockStore((s) => s.adjustments);
  const threshold = useStockStore((s) => s.settings.low_stock_threshold);
  return useMemo(
    () => buildInventory({ purchases, sales, adjustments, expenses: [] }, threshold),
    [purchases, sales, adjustments, threshold],
  );
}

/** Reuses the memoized inventory from `useInventory` instead of rebuilding it. */
export function useMetrics() {
  const expenses = useStockStore((s) => s.expenses);
  const purchases = useStockStore((s) => s.purchases);
  const sales = useStockStore((s) => s.sales);
  const adjustments = useStockStore((s) => s.adjustments);
  const inventory = useInventory();
  return useMemo(
    () => computeMetrics({ purchases, sales, adjustments, expenses }, inventory),
    [purchases, sales, adjustments, expenses, inventory],
  );
}

export function useCurrency() {
  return useStockStore((s) => s.settings.currency_symbol || "Rs.");
}

export function useIsReadOnly() {
  return useStockStore((s) => s.sheetRole === "read");
}

export function useInvestments() {
  return useStockStore((s) => s.investments);
}

