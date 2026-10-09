// Tests for format utils
import { safeDate, formatDate, todayISO, toNumber, formatUnits } from "@/utils/format";

describe("format", () => {
  describe("safeDate", () => {
    it("should parse YYYY-MM-DD as local midnight", () => {
      const d = safeDate("2026-09-14");
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8);
      expect(d?.getDate()).toBe(14);
      expect(d?.getHours()).toBe(0);
    });

    it("should parse full ISO timestamps", () => {
      const d = safeDate("2026-09-14T10:30:00Z");
      expect(d).not.toBeNull();
      expect(d?.toISOString()).toBe("2026-09-14T10:30:00.000Z");
    });

    it("should return null for empty and missing values", () => {
      expect(safeDate(undefined)).toBeNull();
      expect(safeDate("")).toBeNull();
    });

    it("should reject invalid dates instead of rolling them over", () => {
      // Date would silently become 2026-03-03; the fast path must not.
      expect(safeDate("2026-02-31")).toBeNull();
      expect(safeDate("2026-13-01")).toBeNull();
      expect(safeDate("2026-00-10")).toBeNull();
      expect(safeDate("not-a-date")).toBeNull();
    });

    it("should agree with the slow path for every day of a leap year", () => {
      const leap = 2028;
      for (let day = 1; day <= 366; day++) {
        const value = `${leap}-02-${String(day).padStart(2, "0")}`;
        if (day > 29) {
          expect(safeDate(value)).toBeNull();
        } else {
          expect(safeDate(value)?.getDate()).toBe(day);
        }
      }
    });
  });

  describe("formatDate", () => {
    it("should format a valid date", () => {
      expect(formatDate("2026-09-14")).toBe("14 Sep 2026");
    });

    it("should show a dash for invalid input", () => {
      expect(formatDate(undefined)).toBe("—");
      expect(formatDate("2026-02-31")).toBe("—");
    });
  });

  describe("todayISO", () => {
    it("should return a YYYY-MM-DD string", () => {
      expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("toNumber", () => {
    it("should parse numbers and numeric strings", () => {
      expect(toNumber(42)).toBe(42);
      expect(toNumber("42.5")).toBe(42.5);
    });

    it("should fall back to zero for junk", () => {
      expect(toNumber("abc")).toBe(0);
      expect(toNumber(NaN)).toBe(0);
      expect(toNumber(Infinity)).toBe(0);
    });
  });

  describe("formatUnits", () => {
    it("should round and group", () => {
      expect(formatUnits(1234.6)).toBe("1,235");
      expect(formatUnits(NaN)).toBe("0");
    });
  });
});