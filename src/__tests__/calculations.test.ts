// Tests for calculations module
import {
  weightedAverageCosts,
  buildInventory,
  computeMetrics,
  costOfGoodsSold,
  inRange,
} from "@/services/calculations";
import type { Purchase, Sale, Adjustment, Expense } from "@/types";

describe("calculations", () => {
  describe("weightedAverageCosts", () => {
    it("should calculate weighted average cost correctly", () => {
      const purchases: Purchase[] = [
        {
          record_id: "BUY-20260914-000001",
          date: "2026-09-14",
          model: "ModelA",
          quantity: 10,
          buying_price: 10.0,
          total_cost: 100.0,
          supplier: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T10:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T10:00:00Z",
        },
        {
          record_id: "BUY-20260914-000002",
          date: "2026-09-14",
          model: "ModelA",
          quantity: 20,
          buying_price: 20.0,
          total_cost: 400.0,
          supplier: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T11:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T11:00:00Z",
        },
        {
          record_id: "BUY-20260914-000003",
          date: "2026-09-14",
          model: "ModelB",
          quantity: 5,
          buying_price: 15.0,
          total_cost: 75.0,
          supplier: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T12:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T12:00:00Z",
        },
      ];

      const result = weightedAverageCosts(purchases);

      // ModelA: (10*10 + 20*20) / (10+20) = (100 + 400) / 30 = 500/30 = 16.666...
      expect(result["ModelA"]).toBeCloseTo(16.6667);
      // ModelB: 15.0
      expect(result["ModelB"]).toBe(15.0);
    });

    it("should return empty object for empty purchases", () => {
      const result = weightedAverageCosts([]);
      expect(result).toEqual({});
    });
  });

  describe("buildInventory", () => {
    it("should build inventory with correct calculations", () => {
      const purchases: Purchase[] = [
        {
          record_id: "BUY-20260914-000001",
          date: "2026-09-14",
          model: "TestModel",
          quantity: 100,
          buying_price: 10.0,
          total_cost: 1000.0,
          supplier: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T10:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T10:00:00Z",
        },
      ];

      const sales: Sale[] = [
        {
          record_id: "SELL-20260914-000001",
          date: "2026-09-14",
          model: "TestModel",
          quantity: 30,
          selling_price: 15.0,
          total_sale: 450.0,
          profit: 150.0, // This will be overwritten by calculations
          customer: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T11:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T11:00:00Z",
        },
      ];

      const adjustments: Adjustment[] = [
        {
          record_id: "ADJ-20260914-000001",
          date: "2026-09-14",
          model: "TestModel",
          quantity: 10,
          type: "Found Stock (+)",
          reason: "Found in warehouse",
          created_by: "test",
          created_at: "2026-09-14T12:00:00Z",
        },
      ];

      const expenses: Expense[] = []; // Not used in inventory calculation

      const inventory = buildInventory({ purchases, sales, adjustments, expenses }, 5);

      expect(inventory.length).toBe(1);
      const item = inventory[0];

      expect(item).toBeDefined();
      if (!item) return;
      expect(item.model).toBe("TestModel");
      expect(item.bought).toBe(100);
      expect(item.sold).toBe(30);
      expect(item.adjusted).toBe(10);
      expect(item.remaining).toBe(80); // 100 - 30 + 10
      expect(item.avg_cost).toBe(10.0); // 1000/100
      expect(item.total_investment).toBe(1000.0);
      expect(item.total_sales).toBe(450.0);
      expect(item.gross_profit).toBeCloseTo(150.0); // 450 - (30 * 10) = 150
      expect(item.estimated_value).toBe(800.0); // remaining * avg_cost = 80 * 10
      expect(item.status).toBe("IN STOCK"); // 80 > 5 threshold
    });

    it("should derive latest prices from the chronologically last record", () => {
      const purchases: Purchase[] = [
        {
          record_id: "BUY-20260912-000001",
          date: "2026-09-12",
          model: "M",
          quantity: 5,
          buying_price: 10,
          total_cost: 50,
          supplier: "",
          remarks: "",
          created_by: "t",
          created_at: "2026-09-12T10:00:00Z",
          updated_by: "t",
          updated_at: "2026-09-12T10:00:00Z",
        },
        {
          record_id: "BUY-20260914-000001",
          date: "2026-09-14",
          model: "M",
          quantity: 5,
          buying_price: 20,
          total_cost: 100,
          supplier: "",
          remarks: "",
          created_by: "t",
          created_at: "2026-09-14T10:00:00Z",
          updated_by: "t",
          updated_at: "2026-09-14T10:00:00Z",
        },
      ];

      const [item] = buildInventory({ purchases, sales: [], adjustments: [], expenses: [] }, 5);
      // Must not depend on the input array's order.
      expect(item?.latest_buy_price).toBe(20);
    });

    it("should stay fast on a large multi-model dataset", () => {
      const purchases: Purchase[] = Array.from({ length: 6000 }, (_, i) => ({
        record_id: `BUY-20260914-${String(i).padStart(6, "0")}`,
        date: "2026-09-14",
        model: `Model${i % 120}`,
        quantity: 10,
        buying_price: 5,
        total_cost: 50,
        supplier: "",
        remarks: "",
        created_by: "t",
        created_at: "2026-09-14T10:00:00Z",
        updated_by: "t",
        updated_at: "2026-09-14T10:00:00Z",
      }));

      const started = Date.now();
      const inventory = buildInventory({ purchases, sales: [], adjustments: [], expenses: [] }, 5);
      const elapsed = Date.now() - started;

      expect(inventory.length).toBe(120);
      // The old O(models x rows) version took seconds at this size.
      expect(elapsed).toBeLessThan(500);
    });

    it("should not mutate the input arrays", () => {
      const purchases: Purchase[] = [
        {
          record_id: "BUY-20260914-000002",
          date: "2026-09-14",
          model: "M",
          quantity: 1,
          buying_price: 1,
          total_cost: 1,
          supplier: "",
          remarks: "",
          created_by: "t",
          created_at: "2026-09-14T10:00:00Z",
          updated_by: "t",
          updated_at: "2026-09-14T10:00:00Z",
        },
        {
          record_id: "BUY-20260914-000001",
          date: "2026-09-13",
          model: "M",
          quantity: 1,
          buying_price: 1,
          total_cost: 1,
          supplier: "",
          remarks: "",
          created_by: "t",
          created_at: "2026-09-13T10:00:00Z",
          updated_by: "t",
          updated_at: "2026-09-13T10:00:00Z",
        },
      ];
      const before = purchases.map((p) => p.record_id);

      buildInventory({ purchases, sales: [], adjustments: [], expenses: [] }, 5);

      expect(purchases.map((p) => p.record_id)).toEqual(before);
    });
  });

  describe("computeMetrics", () => {
    it("should compute metrics correctly", () => {
      const purchases: Purchase[] = [
        {
          record_id: "BUY-20260914-000001",
          date: "2026-09-14",
          model: "ModelA",
          quantity: 100,
          buying_price: 10.0,
          total_cost: 1000.0,
          supplier: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T10:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T10:00:00Z",
        },
      ];

      const sales: Sale[] = [
        {
          record_id: "SELL-20260914-000001",
          date: "2026-09-14",
          model: "ModelA",
          quantity: 50,
          selling_price: 20.0,
          total_sale: 1000.0,
          profit: 0, // Will be calculated
          customer: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T11:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T11:00:00Z",
        },
      ];

      const adjustments: Adjustment[] = [];
      const expenses: Expense[] = [
        {
          record_id: "EXPENSE-20260914-000001",
          date: "2026-09-14",
          expense_type: "Rent",
          amount: 200.0,
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T12:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T12:00:00Z",
        },
      ];

      const inventory = buildInventory({ purchases, sales, adjustments, expenses }, 5);
      const metrics = computeMetrics({ purchases, sales, adjustments, expenses }, inventory);

      expect(metrics.total_stock_units).toBe(50); // 100 - 50 = 50 remaining
      expect(metrics.unique_models_in_stock).toBe(1);
      expect(metrics.total_investment).toBe(1000.0);
      expect(metrics.total_sales_revenue).toBe(1000.0);
      expect(metrics.gross_profit).toBeCloseTo(500.0); // 1000 - (50 * 10) = 500
      expect(metrics.total_expenses).toBe(200.0);
      expect(metrics.net_profit).toBeCloseTo(300.0); // 500 - 200 = 300
      expect(metrics.low_stock_count).toBe(0); // 50 remaining > 5 threshold
    });
  });

  describe("costOfGoodsSold", () => {
    it("should calculate COGS correctly", () => {
      const purchases: Purchase[] = [
        {
          record_id: "BUY-20260914-000001",
          date: "2026-09-14",
          model: "ModelA",
          quantity: 100,
          buying_price: 10.0,
          total_cost: 1000.0,
          supplier: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T10:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T10:00:00Z",
        },
      ];

      const sales: Sale[] = [
        {
          record_id: "SELL-20260914-000001",
          date: "2026-09-14",
          model: "ModelA",
          quantity: 50,
          selling_price: 20.0,
          total_sale: 1000.0,
          profit: 0,
          customer: "",
          remarks: "",
          created_by: "test",
          created_at: "2026-09-14T11:00:00Z",
          updated_by: "test",
          updated_at: "2026-09-14T11:00:00Z",
        },
      ];

      const cogs = costOfGoodsSold({ purchases, sales, adjustments: [], expenses: [] });
      expect(cogs).toBe(500.0); // 50 * 10 = 500
    });
  });

  describe("inRange", () => {
    it("should return true for date within range", () => {
      expect(inRange("2026-09-15", "2026-09-14", "2026-09-16")).toBe(true);
    });

    it("should return false for date before range", () => {
      expect(inRange("2026-09-13", "2026-09-14", "2026-09-16")).toBe(false);
    });

    it("should return false for date after range", () => {
      expect(inRange("2026-09-17", "2026-09-14", "2026-09-16")).toBe(false);
    });

    it("should return true when no start date", () => {
      expect(inRange("2026-09-15", "", "2026-09-16")).toBe(true);
    });

    it("should return true when no end date", () => {
      expect(inRange("2026-09-15", "2026-09-14", "")).toBe(true);
    });

    it("should return false for invalid date", () => {
      expect(inRange("invalid", "2026-09-14", "2026-09-16")).toBe(false);
    });
  });
});
