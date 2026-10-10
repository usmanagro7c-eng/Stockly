import type { BackupFile } from "@/types";

export function buildBackup(
  payload: Omit<BackupFile, "app" | "version" | "exported_at">,
): BackupFile {
  return {
    app: "Stockly",
    version: 1,
    exported_at: new Date().toISOString(),
    ...payload,
  };
}

export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid backup file: not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid backup file");
  const b = parsed as Partial<BackupFile>;
  if (b.app !== "Stockly") throw new Error("Invalid backup file: not a Stockly backup");
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    app: "Stockly",
    version: typeof b.version === "number" ? b.version : 1,
    exported_at: typeof b.exported_at === "string" ? b.exported_at : new Date().toISOString(),
    settings: b.settings && typeof b.settings === "object" ? b.settings : {},
    purchases: arr(b.purchases),
    sales: arr(b.sales),
    expenses: arr(b.expenses),
    adjustments: arr(b.adjustments),
    changelogs: arr(b.changelogs),
    investments: arr(b.investments),
  };
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
