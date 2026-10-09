// Tests for ids module
import { generateRecordId, generateDeviceId } from "@/services/ids";
import { format } from "date-fns";

const today = format(new Date(), "yyyyMMdd");

describe("ids", () => {
  describe("generateRecordId", () => {
    it("should generate correct format", () => {
      const existing: string[] = [];
      const id = generateRecordId("BUY", existing);

      // Should be BUY-YYYYMMDD-000001
      expect(id).toMatch(/^BUY-\d{8}-\d{6}$/);
      expect(id.startsWith("BUY-")).toBe(true);
    });

    it("should generate sequential IDs", () => {
      const existing: string[] = [
        `BUY-${today}-000001`,
        `BUY-${today}-000002`,
        `BUY-${today}-000005`,
      ];

      const id = generateRecordId("BUY", existing);
      // Should be 000006 (next after 000005)
      expect(id).toBe(`BUY-${today}-000006`);
    });

    it("should handle different dates", () => {
      const yesterday = format(new Date(Date.now() - 86400000), "yyyyMMdd");
      const existing: string[] = [`BUY-${yesterday}-000005`, `BUY-${today}-000002`];

      // For today, should start at 000003
      const id = generateRecordId("BUY", existing);
      expect(id).toBe(`BUY-${today}-000003`);
    });

    it("should work with SELL prefix", () => {
      const existing: string[] = [];
      const id = generateRecordId("SELL", existing);
      expect(id).toMatch(/^SELL-\d{8}-\d{6}$/);
    });

    it("should work with EXPENSE prefix", () => {
      const existing: string[] = [];
      const id = generateRecordId("EXPENSE", existing);
      expect(id).toMatch(/^EXPENSE-\d{8}-\d{6}$/);
    });

    it("should work with ADJ prefix", () => {
      const existing: string[] = [];
      const id = generateRecordId("ADJ", existing);
      expect(id).toMatch(/^ADJ-\d{8}-\d{6}$/);
    });

    it("should work with CHANGE prefix", () => {
      const existing: string[] = [];
      const id = generateRecordId("CHANGE", existing);
      expect(id).toMatch(/^CHANGE-\d{8}-\d{6}$/);
    });

    it("should skip a taken ID and continue past it", () => {
      const existing = [`CHANGE-${today}-000001`, `CHANGE-${today}-000002`];
      // Forces the collision walk: max is 2 but 000002 is already taken.
      expect(generateRecordId("CHANGE", existing)).toBe(`CHANGE-${today}-000003`);
    });

    it("should terminate on a pathological run of consecutive IDs", () => {
      // A corrupt or hand-edited backup can contain a long consecutive run.
      // The generator must still return instead of spinning forever.
      const existing = Array.from(
        { length: 5000 },
        (_, i) => `CHANGE-${today}-${String(i + 1).padStart(6, "0")}`,
      );

      const id = generateRecordId("CHANGE", existing);
      expect(id).toMatch(/^CHANGE-\d{8}-\d{6}$/);
    });

    it("should stay fast with a large existing set", () => {
      const existing = Array.from(
        { length: 20000 },
        (_, i) => `BUY-${today}-${String(i + 1).padStart(6, "0")}`,
      );

      const started = Date.now();
      const id = generateRecordId("BUY", existing);
      expect(Date.now() - started).toBeLessThan(500);
      expect(id).toBe(`BUY-${today}-020001`);
    });
  });

  describe("generateDeviceId", () => {
    it("should generate correct format", () => {
      const id = generateDeviceId();
      expect(id).toMatch(/^WEB-[0-9A-F]{8}$/);
      expect(id.startsWith("WEB-")).toBe(true);
      expect(id.length).toBe(12); // WEB- + 8 hex chars
    });

    it("should generate different IDs on multiple calls", () => {
      const id1 = generateDeviceId();
      const id2 = generateDeviceId();
      // Very unlikely to be the same
      expect(id1).not.toBe(id2);
    });
  });
});
