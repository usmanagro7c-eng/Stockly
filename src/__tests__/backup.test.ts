// Tests for backup module
import { buildBackup, parseBackup, downloadJSON } from "@/services/backup";
import type { BackupFile } from "@/types";

describe("backup", () => {
  describe("buildBackup", () => {
    it("should create a valid backup object", () => {
      const data = {
        settings: { user_name: "Test", device_id: "WEB-1234" },
        purchases: [],
        sales: [],
        expenses: [],
        adjustments: [],
        changelogs: [],
      };

      const backup = buildBackup(data);

      expect(backup.app).toBe("Stockly");
      expect(backup.version).toBe(1);
      expect(backup.exported_at).toBeDefined();
      expect(backup.settings).toEqual(data.settings);
      expect(backup.purchases).toEqual(data.purchases);
      expect(backup.sales).toEqual(data.sales);
      expect(backup.expenses).toEqual(data.expenses);
      expect(backup.adjustments).toEqual(data.adjustments);
      expect(backup.changelogs).toEqual(data.changelogs);
    });
  });

  describe("parseBackup", () => {
    it("should parse a valid backup", () => {
      const backupData = {
        app: "Stockly",
        version: 1,
        exported_at: "2026-09-14T10:00:00Z",
        settings: { user_name: "Test", device_id: "WEB-1234" },
        purchases: [],
        sales: [],
        expenses: [],
        adjustments: [],
        changelogs: [],
      };

      const jsonString = JSON.stringify(backupData);
      const parsed = parseBackup(jsonString);

      expect(parsed.app).toBe("Stockly");
      expect(parsed.version).toBe(1);
      expect(parsed.exported_at).toBe("2026-09-14T10:00:00Z");
      expect(parsed.settings).toEqual(backupData.settings);
    });

    it("should throw error for invalid JSON", () => {
      expect(() => parseBackup("invalid json")).toThrow(/Invalid backup file: not valid JSON/);
    });

    it("should throw error for non-object", () => {
      expect(() => parseBackup("[1,2,3]")).toThrow(/Invalid backup file/);
    });

    it("should throw error for wrong app", () => {
      const backupData = {
        app: "NotStockly",
        version: 1,
        exported_at: "2026-09-14T10:00:00Z",
        settings: {},
        purchases: [],
        sales: [],
        expenses: [],
        adjustments: [],
        changelogs: [],
      };

      expect(() => parseBackup(JSON.stringify(backupData))).toThrow(
        /Invalid backup file: not a Stockly backup/,
      );
    });

    it("should handle missing arrays gracefully", () => {
      const backupData = {
        app: "Stockly",
        version: 1,
        exported_at: "2026-09-14T10:00:00Z",
        settings: { user_name: "Test" },
        // Missing arrays - should default to empty
      };

      const parsed = parseBackup(JSON.stringify(backupData));
      expect(parsed.purchases).toEqual([]);
      expect(parsed.sales).toEqual([]);
      expect(parsed.expenses).toEqual([]);
      expect(parsed.adjustments).toEqual([]);
      expect(parsed.changelogs).toEqual([]);
    });
  });
});
