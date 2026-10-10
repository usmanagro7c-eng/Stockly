import type { EntityTable, Table } from "dexie";
import { getDB } from "./db";
import { generateDeviceId } from "@/services/ids";
import type { Adjustment, ChangeLog, Expense, Investment, Purchase, Sale, Settings } from "@/types";

/**
 * Central storage repository. UI and store code talk to this layer only —
 * never to IndexedDB directly. A cloud API can be added behind these
 * same methods later without touching the app.
 */

export const DEFAULT_SETTINGS: Settings = {
  user_name: "",
  device_id: "",
  currency_symbol: "Rs.",
  low_stock_threshold: 5,
  pin_code_hash: "",
  linked_file_name: "",
  last_sync_time: "",
  theme_mode: "dark",
};

const SETTINGS_KEY = "app";

/**
 * Makes one table match `rows`: writes only entries that changed and deletes
 * only the keys that disappeared. Must be called inside a Dexie transaction.
 */
async function syncTable<T extends object, K extends keyof T>(
  table: Table<T, string>,
  rows: T[],
  key: K,
): Promise<void> {
  const existing = await table.toArray();

  const priorByKey = new Map<string, T>();
  for (const e of existing) {
    const k = String(e[key] ?? "");
    if (k !== "") priorByKey.set(k, e);
  }

  const incomingKeys = new Set<string>();
  const changed: T[] = [];
  for (const r of rows) {
    const k = String(r[key] ?? "");
    if (k === "") continue;
    incomingKeys.add(k);
    const prior = priorByKey.get(k);
    if (prior === undefined || JSON.stringify(prior) !== JSON.stringify(r)) changed.push(r);
  }

  const removed: string[] = [];
  for (const k of priorByKey.keys()) {
    if (!incomingKeys.has(k)) removed.push(k);
  }

  if (removed.length) await table.bulkDelete(removed);
  if (changed.length) await table.bulkPut(changed);
}

function sanitize<T extends object>(rows: unknown[], required: (keyof T)[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as T;
    if (required.every((k) => r[k] !== undefined && r[k] !== null)) out.push(r);
  }
  return out;
}

export const repository = {
  async loadAll() {
    const db = getDB();
    const [purchases, sales, expenses, adjustments, changelogs, investments, settingsRow] =
      await Promise.all([
        db.purchases.toArray(),
        db.sales.toArray(),
        db.expenses.toArray(),
        db.adjustments.toArray(),
        db.changelogs.toArray(),
        db.investments.toArray(),
        db.settings.get(SETTINGS_KEY),
      ]);

    let settings: Settings = settingsRow
      ? { ...DEFAULT_SETTINGS, ...settingsRow }
      : { ...DEFAULT_SETTINGS };

    if (!settings.device_id) {
      settings = { ...settings, device_id: generateDeviceId() };
      await repository.saveSettings(settings);
    }

    return {
      purchases: sanitize<Purchase>(purchases, ["record_id", "model", "quantity"]),
      sales: sanitize<Sale>(sales, ["record_id", "model", "quantity"]),
      expenses: sanitize<Expense>(expenses, ["record_id", "amount"]),
      adjustments: sanitize<Adjustment>(adjustments, ["record_id", "model"]),
      changelogs: sanitize<ChangeLog>(changelogs, ["change_id"]),
      investments: sanitize<Investment>(investments, ["record_id", "investor", "amount"]),
      settings,
    };
  },

  async saveSettings(settings: Settings) {
    await getDB().settings.put({ ...settings, id: SETTINGS_KEY });
  },

  purchases: {
    put: (row: Purchase) => getDB().purchases.put(row),
    remove: (id: string) => getDB().purchases.delete(id),
  },
  sales: {
    put: (row: Sale) => getDB().sales.put(row),
    remove: (id: string) => getDB().sales.delete(id),
  },
  expenses: {
    put: (row: Expense) => getDB().expenses.put(row),
    remove: (id: string) => getDB().expenses.delete(id),
  },
  adjustments: {
    put: (row: Adjustment) => getDB().adjustments.put(row),
    remove: (id: string) => getDB().adjustments.delete(id),
  },
  changelogs: {
    put: (row: ChangeLog) => getDB().changelogs.put(row),
    remove: (ids: string[]) => getDB().changelogs.bulkDelete(ids),
  },
  investments: {
    put: (row: Investment) => getDB().investments.put(row),
    remove: (id: string) => getDB().investments.delete(id),
  },

  async replaceAll(data: {
    purchases: Purchase[];
    sales: Sale[];
    expenses: Expense[];
    adjustments: Adjustment[];
    changelogs: ChangeLog[];
    investments?: Investment[];
  }) {
    const db = getDB();
    await db.transaction(
      "rw",
      [db.purchases, db.sales, db.expenses, db.adjustments, db.changelogs, db.investments],
      async () => {
        await syncTable(db.purchases, data.purchases, "record_id");
        await syncTable(db.sales, data.sales, "record_id");
        await syncTable(db.expenses, data.expenses, "record_id");
        await syncTable(db.adjustments, data.adjustments, "record_id");
        await syncTable(db.changelogs, data.changelogs, "change_id");
        if (data.investments) {
          await syncTable(db.investments, data.investments, "record_id");
        }
      },
    );
  },

  async mergeAll(data: {
    purchases: Purchase[];
    sales: Sale[];
    expenses: Expense[];
    adjustments: Adjustment[];
    changelogs: ChangeLog[];
    investments?: Investment[];
  }) {
    const db = getDB();
    await db.transaction(
      "rw",
      [db.purchases, db.sales, db.expenses, db.adjustments, db.changelogs, db.investments],
      async () => {
        await Promise.all([
          db.purchases.bulkPut(data.purchases),
          db.sales.bulkPut(data.sales),
          db.expenses.bulkPut(data.expenses),
          db.adjustments.bulkPut(data.adjustments),
          db.changelogs.bulkPut(data.changelogs),
          data.investments && data.investments.length
            ? db.investments.bulkPut(data.investments)
            : Promise.resolve(),
        ]);
      },
    );
  },
};
