import { repository } from "./database/repository";
import type { Purchase, Sale, Expense, Adjustment, ChangeLog, Investment, Settings } from "@/types";
import {
  sheetsService,
  purchasesToSheet,
  salesToSheet,
  expensesToSheet,
  adjustmentsToSheet,
  changelogsToSheet,
  investmentsToSheet,
  purchasesFromSheet,
  salesFromSheet,
  expensesFromSheet,
  adjustmentsFromSheet,
  changelogsFromSheet,
  investmentsFromSheet,
  type SheetData,
  type SheetRow,
} from "./google-sheets";
import {
  getAccessToken,
  getGoogleRole,
  setGoogleRole,
  setGoogleSheetTitle,
} from "./google-auth";

/**
 * Sync manager — pushes local data to a Google Sheet and pulls it back,
 * resolving conflicts with a "newest updated_at wins" strategy.
 */
type MergeKey = "record_id" | "change_id";

type WithTimestamp<T> = T & { updated_at?: string; created_at?: string };

export type SheetRole = "edit" | "read" | null;

/** Everything a sync pass leaves persisted in the local database. */
export interface SyncedData {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  adjustments: Adjustment[];
  changelogs: ChangeLog[];
  investments: Investment[];
  settings: Settings;
}

const KEY_BY_TABLE = {
  purchases: "record_id",
  sales: "record_id",
  expenses: "record_id",
  adjustments: "record_id",
  changelogs: "change_id",
  investments: "record_id",
} as const;

function newestFirst<T>(a: T, b: T): number {
  const ta = (a as WithTimestamp<T>).updated_at ?? (a as WithTimestamp<T>).created_at ?? "";
  const tb = (b as WithTimestamp<T>).updated_at ?? (b as WithTimestamp<T>).created_at ?? "";
  return ta === tb ? 0 : ta > tb ? -1 : 1;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export interface SyncStatus {
  connected: boolean;
  role: SheetRole;
  email: string | null;
  lastSync: string | null;
  sheetId: string | null;
}

export class SyncManager {
  private sheetId: string | null = null;
  private role: SheetRole = null;
  private dirty = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(role: SheetRole) => void>();

  private get currentSheetId(): string | null {
    if (this.sheetId) return this.sheetId;
    return typeof localStorage !== "undefined" ? localStorage.getItem("googleSheetId") : null;
  }

  isConnected(): boolean {
    return this.currentSheetId !== null;
  }

  getSheetId(): string | null {
    return this.currentSheetId;
  }

  getRole(): SheetRole {
    if (this.role) return this.role;
    return getGoogleRole();
  }

  getStatus(): SyncStatus {
    return {
      connected: this.isConnected(),
      role: this.getRole(),
      email: typeof localStorage !== "undefined" ? localStorage.getItem("googleSheetEmail") : null,
      lastSync: typeof localStorage !== "undefined" ? localStorage.getItem("googleLastSync") : null,
      sheetId: this.currentSheetId,
    };
  }

  async setSheetId(sheetId: string): Promise<void> {
    this.sheetId = sheetId;
    if (typeof localStorage !== "undefined") localStorage.setItem("googleSheetId", sheetId);
  }

  /** Subscribe to role changes. Returns an unsubscribe function. */
  onRoleChange(cb: (role: SheetRole) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setRole(role: SheetRole): void {
    if (this.role === role) return;
    this.role = role;
    setGoogleRole(role);
    this.listeners.forEach((cb) => cb(role));
  }

  /** Detect whether the current account can edit the linked sheet, and save the title and role. */
  async detectPermission(): Promise<SheetRole> {
    const sheetId = this.currentSheetId;
    if (!sheetId) throw new Error("No Google sheet connected");
    await this.configureSheets();
    const access = await sheetsService.checkSheetAccess();
    setGoogleSheetTitle(access.title);
    this.setRole(access.role);
    return this.role;
  }


  private async configureSheets(): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated with Google");
    const sheetId = this.currentSheetId;
    if (!sheetId) throw new Error("No Google sheet connected");
    await sheetsService.setAccessToken(token);
    await sheetsService.setSheetId(sheetId);
  }

  private requireOnline(): void {
    if (!isOnline()) {
      throw new Error("You appear to be offline — connect to the internet to sync");
    }
  }

  /**
   * Merge two record lists keyed by record_id/change_id.
   * When both sides have the same key, the newer updated_at wins.
   */
  mergeRecords<T>(local: T[], remote: T[], key: MergeKey): T[] {
    const map = new Map<string, T>();
    const index = (k: MergeKey) => (r: T) => String((r as Record<string, unknown>)[k] ?? "");
    for (const r of local) map.set(index(key)(r), r);
    for (const r of remote) {
      const id = index(key)(r);
      const existing = map.get(id);
      if (!existing || newestFirst(existing, r) >= 0) {
        map.set(id, existing && newestFirst(existing, r) === 0 ? existing : r);
      }
    }
    return Array.from(map.values());
  }

  /**
   * Push local DB to the Google Sheet. First pulls the latest remote data and
   * merges (newest-wins) so concurrent users converge instead of clobbering.
   */
  async syncToSheets(): Promise<void> {
    this.requireOnline();
    const sheetId = this.currentSheetId;
    if (!sheetId) throw new Error("No Google sheet connected");
    await this.configureSheets();

    try {
      await sheetsService.ensureSheetsExist();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        this.setRole("read");
        throw new Error("Syncing failed — this Google account appears to have read-only access");
      }
      throw err;
    }

    const sheetData = await sheetsService.getSheetData();
    const local = await repository.loadAll();
    const dataAsSheet: SheetData = {
      purchases: this.mergeRecords<SheetRow>(
        purchasesToSheet(local.purchases),
        sheetData.purchases ?? [],
        KEY_BY_TABLE.purchases,
      ),
      sales: this.mergeRecords<SheetRow>(
        salesToSheet(local.sales),
        sheetData.sales ?? [],
        KEY_BY_TABLE.sales,
      ),
      expenses: this.mergeRecords<SheetRow>(
        expensesToSheet(local.expenses),
        sheetData.expenses ?? [],
        KEY_BY_TABLE.expenses,
      ),
      adjustments: this.mergeRecords<SheetRow>(
        adjustmentsToSheet(local.adjustments),
        sheetData.adjustments ?? [],
        KEY_BY_TABLE.adjustments,
      ),
      changelogs: this.mergeRecords<SheetRow>(
        changelogsToSheet(local.changelogs),
        sheetData.changelogs ?? [],
        KEY_BY_TABLE.changelogs,
      ),
      investments: this.mergeRecords<SheetRow>(
        investmentsToSheet(local.investments),
        sheetData.investments ?? [],
        KEY_BY_TABLE.investments,
      ),
    };

    await sheetsService.writeSheetData(dataAsSheet);
    this.dirty = false;
    await this.touchLastSync(local.settings, sheetId);
  }

  /**
   * Pull data from the Google Sheet and merge it into the local DB.
   * Returns the exact dataset that is now persisted locally so callers never
   * have to re-read the whole database.
   */
  async syncFromSheets(): Promise<SyncedData> {
    this.requireOnline();
    const sheetId = this.currentSheetId;
    if (!sheetId) throw new Error("No Google sheet connected");
    await this.configureSheets();

    try {
      await sheetsService.ensureSheetsExist();
    } catch {
      // A viewer may not be able to create tabs — that's fine, they can still read.
    }

    const sheetData = await sheetsService.getSheetData();
    const local = await repository.loadAll();

    const merged = {
      purchases: this.mergeRecords<Purchase>(
        local.purchases,
        purchasesFromSheet(sheetData.purchases ?? []),
        KEY_BY_TABLE.purchases,
      ),
      sales: this.mergeRecords<Sale>(
        local.sales,
        salesFromSheet(sheetData.sales ?? []),
        KEY_BY_TABLE.sales,
      ),
      expenses: this.mergeRecords<Expense>(
        local.expenses,
        expensesFromSheet(sheetData.expenses ?? []),
        KEY_BY_TABLE.expenses,
      ),
      adjustments: this.mergeRecords<Adjustment>(
        local.adjustments,
        adjustmentsFromSheet(sheetData.adjustments ?? []),
        KEY_BY_TABLE.adjustments,
      ),
      changelogs: this.mergeRecords<ChangeLog>(
        local.changelogs,
        changelogsFromSheet(sheetData.changelogs ?? []),
        KEY_BY_TABLE.changelogs,
      ),
      investments: this.mergeRecords<Investment>(
        local.investments,
        investmentsFromSheet(sheetData.investments ?? []),
        KEY_BY_TABLE.investments,
      ),
    };

    await repository.replaceAll(merged);
    const settings = await this.touchLastSync(local.settings, sheetId);
    return { ...merged, settings };
  }

  /** Mark pending local changes and schedule a debounced push (≈3s). */
  markDirty(): void {
    if (!this.isConnected() || this.role === "read") return;
    this.dirty = true;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncToSheets().catch((error) => {
        // Silent failure — the periodic pull will converge later when online.
        if (typeof console !== "undefined") {
          console.warn("Auto-sync push failed:", error);
        }
      });
    }, 3000);
  }

  hasPendingChanges(): boolean {
    return this.dirty;
  }

  private async touchLastSync(settings: Settings, sheetId: string): Promise<Settings> {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("googleLastSync", new Date().toISOString());
    }
    const next: Settings = {
      ...settings,
      linked_file_name: sheetId,
      last_sync_time: new Date().toISOString(),
    };
    await repository.saveSettings(next);
    return next;
  }
}

export const syncManager = new SyncManager();
