// Tests for security module
import { hashPin, verifyPin, isValidPin } from "@/services/security";

describe("security", () => {
  describe("hashPin", () => {
    it("should hash a PIN correctly", async () => {
      const hash = await hashPin("1234");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it("should produce same hash for same PIN", async () => {
      const hash1 = await hashPin("1234");
      const hash2 = await hashPin("1234");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different PINs", async () => {
      const hash1 = await hashPin("1234");
      const hash2 = await hashPin("5678");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPin", () => {
    it("should verify correct PIN", async () => {
      const hash = await hashPin("1234");
      const result = await verifyPin("1234", hash);
      expect(result).toBe(true);
    });

    it("should reject incorrect PIN", async () => {
      const hash = await hashPin("1234");
      const result = await verifyPin("5678", hash);
      expect(result).toBe(false);
    });

    it("should return true for empty hash", async () => {
      const result = await verifyPin("1234", "");
      expect(result).toBe(true);
    });

    it("should return true for undefined hash", async () => {
      const result = await verifyPin("1234", undefined as unknown as string);
      expect(result).toBe(true);
    });
  });

  describe("isValidPin", () => {
    it("should validate 4-digit PIN", () => {
      expect(isValidPin("1234")).toBe(true);
      expect(isValidPin("0000")).toBe(true);
      expect(isValidPin("9999")).toBe(true);
    });

    it("should validate 5-digit PIN", () => {
      expect(isValidPin("12345")).toBe(true);
      expect(isValidPin("00000")).toBe(true);
    });

    it("should validate 6-digit PIN", () => {
      expect(isValidPin("123456")).toBe(true);
      expect(isValidPin("000000")).toBe(true);
      expect(isValidPin("999999")).toBe(true);
    });

    it("should reject 3-digit PIN", () => {
      expect(isValidPin("123")).toBe(false);
    });

    it("should reject 7-digit PIN", () => {
      expect(isValidPin("1234567")).toBe(false);
    });

    it("should reject non-digit characters", () => {
      expect(isValidPin("12a4")).toBe(false);
      expect(isValidPin("12-4")).toBe(false);
      expect(isValidPin("12 4")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidPin("")).toBe(false);
    });

    it("should reject null", () => {
      // @ts-expect-error - testing invalid input
      expect(isValidPin(null)).toBe(false);
    });

    it("should reject undefined", () => {
      // @ts-expect-error - testing invalid input
      expect(isValidPin(undefined)).toBe(false);
    });
  });
});
