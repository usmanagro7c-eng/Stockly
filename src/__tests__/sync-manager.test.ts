import { describe, it, expect } from "vitest";
import { syncManager } from "@/services/sync-manager";

describe("syncManager.mergeRecords", () => {
  it("merges local and remote records resolving newer updated_at", () => {
    const local = [
      { record_id: "BUY-1", model: "iPhone 13", updated_at: "2026-10-10T12:00:00Z" },
    ];
    const remote = [
      { record_id: "BUY-1", model: "iPhone 13 Pro", updated_at: "2026-10-10T13:00:00Z" },
      { record_id: "BUY-2", model: "Samsung S23", updated_at: "2026-10-10T11:00:00Z" },
    ];

    const result = syncManager.mergeRecords(local, remote, "record_id");
    expect(result).toHaveLength(2);
    const buy1 = result.find((r) => r.record_id === "BUY-1");
    expect(buy1?.model).toBe("iPhone 13 Pro");
  });

  it("filters out deleted records when deletedMap contains the record_id", () => {
    const local = [
      { record_id: "BUY-2", model: "Samsung S23", updated_at: "2026-10-10T11:00:00Z" },
    ];
    const remote = [
      { record_id: "BUY-1", model: "iPhone 13 Pro", updated_at: "2026-10-10T10:00:00Z" },
      { record_id: "BUY-2", model: "Samsung S23", updated_at: "2026-10-10T11:00:00Z" },
    ];

    const deletedMap = new Map<string, string>([
      ["BUY-1", "2026-10-10T10:30:00Z"],
    ]);

    const result = syncManager.mergeRecords(local, remote, "record_id", deletedMap);
    expect(result).toHaveLength(1);
    expect(result[0]?.record_id).toBe("BUY-2");
    expect(result.find((r) => r.record_id === "BUY-1")).toBeUndefined();
  });

  it("does not resurrect deleted records from remote when deleted locally", () => {
    const local: Array<{ record_id: string; model: string; updated_at: string }> = [];
    const remote = [
      { record_id: "SELL-99", model: "iPad Air", updated_at: "2026-10-10T09:00:00Z" },
    ];

    const deletedMap = new Map<string, string>([
      ["SELL-99", "2026-10-10T09:30:00Z"],
    ]);

    const result = syncManager.mergeRecords(local, remote, "record_id", deletedMap);
    expect(result).toHaveLength(0);
  });
});
