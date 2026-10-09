import Dexie, { type EntityTable } from "dexie";
import type { Adjustment, ChangeLog, Expense, Purchase, Sale, Settings } from "@/types";

export interface SettingsRow extends Settings {
  id: string;
}

// Dexie v4: declare the DB shape as an interface, not a class.
// The class-extend pattern can fail in some Vite/bundler builds when the
// Dexie module is not fully initialised before the subclass body runs.
export type StocklyDB = Dexie & {
  purchases: EntityTable<Purchase, "record_id">;
  sales: EntityTable<Sale, "record_id">;
  expenses: EntityTable<Expense, "record_id">;
  adjustments: EntityTable<Adjustment, "record_id">;
  changelogs: EntityTable<ChangeLog, "change_id">;
  settings: EntityTable<SettingsRow, "id">;
};

function createDB(): StocklyDB {
  const db = new Dexie("stockly") as StocklyDB;
  db.version(1).stores({
    purchases: "record_id, model, date, supplier, created_at",
    sales: "record_id, model, date, customer, created_at",
    expenses: "record_id, expense_type, date, created_at",
    adjustments: "record_id, model, date, created_at",
    changelogs: "change_id, timestamp, user, action, section, record_id",
    settings: "id",
  });
  return db;
}

let instance: StocklyDB | null = null;

/** IndexedDB only exists in the browser — never touch it during SSR. */
export function getDB(): StocklyDB {
  if (typeof window === "undefined") {
    throw new Error("Stockly storage is only available in the browser");
  }
  if (!instance) instance = createDB();
  return instance;
}

export const isBrowser = () => typeof window !== "undefined" && !!window.indexedDB;
