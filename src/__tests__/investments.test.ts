import { describe, expect, it } from "vitest";
import { investmentsToSheet, investmentsFromSheet } from "@/services/google-sheets";
import { generateRecordId } from "@/services/ids";
import { buildBackup, parseBackup } from "@/services/backup";
import type { Investment } from "@/types";

describe("Investments feature", () => {
  const sampleInvestments: Investment[] = [
    {
      record_id: "INV-20261010-000001",
      date: "2026-10-10",
      investor: "Usman Amjad",
      amount: 500000,
      type: "Capital Injection",
      remarks: "Primary seed capital",
      created_by: "Usman Amjad",
      created_at: "2026-10-10T10:00:00.000Z",
      updated_by: "Usman Amjad",
      updated_at: "2026-10-10T10:00:00.000Z",
    },
    {
      record_id: "INV-20261010-000002",
      date: "2026-10-10",
      investor: "Partner A",
      amount: 150000,
      type: "Drawings / Withdrawal",
      remarks: "Profit share payout",
      created_by: "Usman Amjad",
      created_at: "2026-10-10T11:00:00.000Z",
      updated_by: "Usman Amjad",
      updated_at: "2026-10-10T11:00:00.000Z",
    },
  ];

  it("should generate sequential record IDs with INV prefix", () => {
    const id1 = generateRecordId("INV", []);
    expect(id1).toMatch(/^INV-\d{8}-000001$/);

    const id2 = generateRecordId("INV", [id1]);
    expect(id2).toMatch(/^INV-\d{8}-000002$/);
  });

  it("should convert investments to Google Sheet rows and back without data loss", () => {
    const sheetRows = investmentsToSheet(sampleInvestments);
    expect(sheetRows).toHaveLength(2);
    expect(sheetRows[0].record_id).toBe("INV-20261010-000001");
    expect(sheetRows[0].investor).toBe("Usman Amjad");
    expect(sheetRows[0].amount).toBe(500000);
    expect(sheetRows[0].type).toBe("Capital Injection");

    const parsed = investmentsFromSheet(sheetRows);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].record_id).toBe("INV-20261010-000001");
    expect(parsed[0].investor).toBe("Usman Amjad");
    expect(parsed[0].amount).toBe(500000);
    expect(parsed[0].type).toBe("Capital Injection");
    expect(parsed[1].type).toBe("Drawings / Withdrawal");
  });

  it("should include investments in backup export and restore", () => {
    const data = {
      settings: { user_name: "Usman Amjad", device_id: "WEB-TEST" },
      purchases: [],
      sales: [],
      expenses: [],
      adjustments: [],
      changelogs: [],
      investments: sampleInvestments,
    };

    const backup = buildBackup(data);
    expect(backup.investments).toHaveLength(2);

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.investments).toHaveLength(2);
    expect(parsed.investments[0].investor).toBe("Usman Amjad");
  });
});
