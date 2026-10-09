import Dexie, { type Table } from "dexie";
import type { Adjustment, ChangeLog, Expense, Purchase, Sale, Settings } from "@/types";

export interface SettingsRow extends Settings {
  id: string;
}

export class StocklyDB extends Dexie {
  purchases!: Table<Purchase, string>;
  sales!: Table<Sale, string>;
  expenses!: Table<Expense, string>;
  adjustments!: Table<Adjustment, string>;
  changelogs!: Table<ChangeLog, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super("stockly");
    this.version(1).stores({
      purchases: "record_id, model, date, supplier, created_at",
      sales: "record_id, model, date, customer, created_at",
      expenses: "record_id, expense_type, date, created_at",
      adjustments: "record_id, model, date, created_at",
      changelogs: "change_id, timestamp, user, action, section, record_id",
      settings: "id",
    });
  }
}

let instance: StocklyDB | null = null;

/** IndexedDB only exists in the browser — never touch it during SSR. */
export function getDB(): StocklyDB {
  if (typeof window === "undefined") {
    throw new Error("Stockly storage is only available in the browser");
  }
  if (!instance) instance = new StocklyDB();
  return instance;
}

export const isBrowser = () => typeof window !== "undefined" && !!window.indexedDB;
