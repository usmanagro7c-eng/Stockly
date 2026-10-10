import type { Purchase, Sale, Expense, Adjustment, ChangeLog } from "@/types";

const SHEET_NAMES = {
  purchases: "purchases",
  sales: "sales",
  expenses: "expenses",
  adjustments: "adjustments",
  changelogs: "changelogs",
} as const;

// Column definitions for each sheet
const SHEET_COLUMNS = {
  [SHEET_NAMES.purchases]: [
    "record_id",
    "date",
    "model",
    "quantity",
    "buying_price",
    "total_cost",
    "supplier",
    "remarks",
    "created_by",
    "created_at",
    "updated_by",
    "updated_at",
  ],
  [SHEET_NAMES.sales]: [
    "record_id",
    "date",
    "model",
    "quantity",
    "selling_price",
    "total_sale",
    "profit",
    "customer",
    "remarks",
    "created_by",
    "created_at",
    "updated_by",
    "updated_at",
  ],
  [SHEET_NAMES.expenses]: [
    "record_id",
    "date",
    "expense_type",
    "amount",
    "remarks",
    "created_by",
    "created_at",
    "updated_by",
    "updated_at",
  ],
  [SHEET_NAMES.adjustments]: [
    "record_id",
    "date",
    "model",
    "quantity",
    "type",
    "reason",
    "created_by",
    "created_at",
  ],
  [SHEET_NAMES.changelogs]: [
    "change_id",
    "timestamp",
    "user",
    "device_id",
    "action",
    "section",
    "record_id",
    "model",
    "quantity",
    "old_value",
    "new_value",
    "remarks",
  ],
};

/** Rows per batchUpdate chunk. Keeps request bodies a bounded size. */
const WRITE_CHUNK_ROWS = 2_000;

/** End column letter for a tab with `count` columns (A -> A, 12 -> L). */
function columnRangeEnd(count: number): string {
  let n = Math.max(1, count);
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Wrap one row of primitives into the batchUpdate cell shape. */
function cellRow(row: (string | number)[]): {
  values: { userEnteredValue: { numberValue?: number; stringValue?: string } }[];
} {
  return {
    values: row.map((value) => ({
      userEnteredValue:
        typeof value === "number" ? { numberValue: value } : { stringValue: String(value ?? "") },
    })),
  };
}

// Type definitions
export interface SheetRow {
  [key: string]: string | number | boolean | null;
}

export interface SheetData {
  [sheetName: string]: SheetRow[];
}

// Helper to escape CSV values
function escapeCSV(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape double quotes and wrap in quotes if needed
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV(data: SheetRow[], columns: string[]): string {
  const rows = [columns.join(",")];
  for (const row of data) {
    const csvRow = columns.map((col) => escapeCSV(row[col] ?? ""));
    rows.push(csvRow.join(","));
  }
  return rows.join("\n");
}

export function fromCSV(csv: string): SheetRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = (lines[0] || "").split(",").map((h) => h.trim());
  const data: SheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i] || "");
    const row: SheetRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    data.push(row);
  }

  return data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Conversion functions
export function purchasesToSheet(purchases: Purchase[]): SheetRow[] {
  return purchases.map((p) => ({
    record_id: p.record_id,
    date: p.date,
    model: p.model,
    quantity: p.quantity,
    buying_price: p.buying_price,
    total_cost: p.total_cost,
    supplier: p.supplier,
    remarks: p.remarks,
    created_by: p.created_by,
    created_at: p.created_at,
    updated_by: p.updated_by,
    updated_at: p.updated_at,
  }));
}

export function purchasesFromSheet(rows: SheetRow[]): Purchase[] {
  return rows.map((r) => ({
    record_id: String(r.record_id || ""),
    date: String(r.date || ""),
    model: String(r.model || ""),
    quantity: Number(r.quantity) || 0,
    buying_price: Number(r.buying_price) || 0,
    total_cost: Number(r.total_cost) || 0,
    supplier: String(r.supplier || ""),
    remarks: String(r.remarks || ""),
    created_by: String(r.created_by || ""),
    created_at: String(r.created_at || ""),
    updated_by: String(r.updated_by || ""),
    updated_at: String(r.updated_at || ""),
  }));
}

export function salesToSheet(sales: Sale[]): SheetRow[] {
  return sales.map((s) => ({
    record_id: s.record_id,
    date: s.date,
    model: s.model,
    quantity: s.quantity,
    selling_price: s.selling_price,
    total_sale: s.total_sale,
    profit: s.profit,
    customer: s.customer,
    remarks: s.remarks,
    created_by: s.created_by,
    created_at: s.created_at,
    updated_by: s.updated_by,
    updated_at: s.updated_at,
  }));
}

export function salesFromSheet(rows: SheetRow[]): Sale[] {
  return rows.map((r) => ({
    record_id: String(r.record_id || ""),
    date: String(r.date || ""),
    model: String(r.model || ""),
    quantity: Number(r.quantity) || 0,
    selling_price: Number(r.selling_price) || 0,
    total_sale: Number(r.total_sale) || 0,
    profit: Number(r.profit) || 0,
    customer: String(r.customer || ""),
    remarks: String(r.remarks || ""),
    created_by: String(r.created_by || ""),
    created_at: String(r.created_at || ""),
    updated_by: String(r.updated_by || ""),
    updated_at: String(r.updated_at || ""),
  }));
}

export function expensesToSheet(expenses: Expense[]): SheetRow[] {
  return expenses.map((e) => ({
    record_id: e.record_id,
    date: e.date,
    expense_type: e.expense_type,
    amount: e.amount,
    remarks: e.remarks,
    created_by: e.created_by,
    created_at: e.created_at,
    updated_by: e.updated_by,
    updated_at: e.updated_at,
  }));
}

export function expensesFromSheet(rows: SheetRow[]): Expense[] {
  return rows.map((r) => ({
    record_id: String(r.record_id || ""),
    date: String(r.date || ""),
    expense_type: String(r.expense_type || ""),
    amount: Number(r.amount) || 0,
    remarks: String(r.remarks || ""),
    created_by: String(r.created_by || ""),
    created_at: String(r.created_at || ""),
    updated_by: String(r.updated_by || ""),
    updated_at: String(r.updated_at || ""),
  }));
}

export function adjustmentsToSheet(adjustments: Adjustment[]): SheetRow[] {
  return adjustments.map((a) => ({
    record_id: a.record_id,
    date: a.date,
    model: a.model,
    quantity: a.quantity,
    type: a.type,
    reason: a.reason,
    created_by: a.created_by,
    created_at: a.created_at,
  }));
}

export function adjustmentsFromSheet(rows: SheetRow[]): Adjustment[] {
  return rows.map((r) => ({
    record_id: String(r.record_id || ""),
    date: String(r.date || ""),
    model: String(r.model || ""),
    quantity: Number(r.quantity) || 0,
    type: String(r.type) as Adjustment["type"],
    reason: String(r.reason || ""),
    created_by: String(r.created_by || ""),
    created_at: String(r.created_at || ""),
  }));
}

export function changelogsToSheet(changelogs: ChangeLog[]): SheetRow[] {
  return changelogs.map((c) => ({
    change_id: c.change_id,
    timestamp: c.timestamp,
    user: c.user,
    device_id: c.device_id,
    action: c.action,
    section: c.section,
    record_id: c.record_id,
    model: c.model,
    quantity: c.quantity,
    old_value: c.old_value,
    new_value: c.new_value,
    remarks: c.remarks,
  }));
}

export function changelogsFromSheet(rows: SheetRow[]): ChangeLog[] {
  return rows.map((r) => ({
    change_id: String(r.change_id || ""),
    timestamp: String(r.timestamp || ""),
    user: String(r.user || ""),
    device_id: String(r.device_id || ""),
    action: String(r.action) as ChangeLog["action"],
    section: String(r.section) as ChangeLog["section"],
    record_id: String(r.record_id || ""),
    model: String(r.model || ""),
    quantity: Number(r.quantity) || 0,
    old_value: String(r.old_value || ""),
    new_value: String(r.new_value || ""),
    remarks: String(r.remarks || ""),
  }));
}

// Sheet service class
type BatchUpdateRequest = {
  updateCells?: {
    range: {
      sheetId: number;
      startRowIndex: number;
      endRowIndex: number;
      startColumnIndex?: number;
    };
    rows: {
      values: { userEnteredValue: { stringValue?: string; numberValue?: number } }[];
    }[];
    fields: string;
  };
  addSheet?: {
    properties: { title: string };
  };
};

const NUMERIC_COLUMNS = new Set([
  "quantity",
  "buying_price",
  "total_cost",
  "selling_price",
  "total_sale",
  "profit",
  "amount",
]);

export class GoogleSheetsService {
  private sheetId: string | null = null;
  private accessToken: string | null = null;

  private get currentSheetId(): string | null {
    if (this.sheetId) return this.sheetId;
    return typeof localStorage !== "undefined" ? localStorage.getItem("googleSheetId") : null;
  }

  private get currentAccessToken(): string | null {
    if (this.accessToken) return this.accessToken;
    return typeof localStorage !== "undefined" ? localStorage.getItem("googleSheetToken") : null;
  }

  async setSheetId(id: string): Promise<void> {
    this.sheetId = id;
    if (typeof localStorage !== "undefined") localStorage.setItem("googleSheetId", id);
  }

  async setAccessToken(token: string): Promise<void> {
    this.accessToken = token;
    if (typeof localStorage !== "undefined") localStorage.setItem("googleSheetToken", token);
  }

  private async fetch<T = unknown>(
    endpointOrMethod: string,
    endpointOrEmpty: string = "",
    body?: unknown,
  ): Promise<T> {
    const sheetId = this.currentSheetId;
    const token = this.currentAccessToken;

    const HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);
    let method = "GET";
    let endpoint = "";
    let requestBody = body;

    if (HTTP_METHODS.has(endpointOrMethod.toUpperCase())) {
      method = endpointOrMethod.toUpperCase();
      endpoint = endpointOrEmpty;
    } else {
      endpoint = endpointOrMethod;
      if (body !== undefined) {
        requestBody = body;
        method = endpoint.includes("/values/") ? "PUT" : "POST";
      } else if (endpointOrEmpty && typeof endpointOrEmpty === "object") {
        requestBody = endpointOrEmpty;
        method = endpoint.includes("/values/") ? "PUT" : "POST";
      } else {
        method = "GET";
      }
    }

    let path = endpoint;
    if (path.startsWith("/?")) {
      path = path.slice(1);
    } else if (path.startsWith("/:")) {
      path = path.slice(1);
    } else if (!path.startsWith("/") && !path.startsWith("?")) {
      path = `/${path}`;
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (requestBody) {
      options.body = JSON.stringify(requestBody);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    options.signal = controller.signal;

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Request to Google Sheets timed out (15s). Please check your internet connection.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error?.message || `Google Sheets API error: ${response.status}`;
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Verify sheet access and determine user role (Editor vs Viewer).
   * Throws if the user's signed-in Google account has no access at all.
   */
  async checkSheetAccess(): Promise<{ title: string; role: "edit" | "read" }> {
    let meta: {
      properties?: { title?: string };
    };

    try {
      meta = await this.fetch<{
        properties?: { title?: string };
      }>("/?fields=properties.title", "");
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401) {
        throw new Error(
          "Your Google session has expired. Please sign in again with Google in Settings.",
        );
      }
      if (status === 403 || status === 404) {
        throw new Error(
          "Access denied: This Google Sheet is not shared with your signed-in Google account. Please ensure the owner shared it with your Gmail, or switch accounts in Settings.",
        );
      }
      throw error;
    }

    const title = meta.properties?.title || "Google Sheet";

    // Test write permission by re-asserting the current title in a :batchUpdate.
    // This is a 100% valid Request shape that applies zero actual changes,
    // but tests write permission cleanly. Viewers receive 403 immediately.
    try {
      await this.fetch<{ replies?: unknown[] }>("/:batchUpdate", "", {
        requests: [
          {
            updateSpreadsheetProperties: {
              properties: {
                title,
              },
              fields: "title",
            },
          },
        ],
      });
      return { title, role: "edit" };
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 403) {
        return { title, role: "read" };
      }
      return { title, role: "read" };
    }
  }

  /**
   * Detect whether the current account has write access to the spreadsheet.
   * A 403 (INSUFFICIENT_PERMISSIONS) means "Viewer" → read-only.
   */
  async checkWritePermission(): Promise<boolean> {
    try {
      const access = await this.checkSheetAccess();
      return access.role === "edit";
    } catch {
      return false;
    }
  }


  async getSheetData(): Promise<SheetData> {
    const sheetIds = await this.getSheetIdMap();

    const names = Object.keys(sheetIds).filter(
      (name) => SHEET_COLUMNS[name as keyof typeof SHEET_COLUMNS],
    );

    // Read every tab concurrently. Reading them one at a time meant a sync
    // waited out five or six sequential round trips before it could start.
    const results = await Promise.all(
      names.map(async (sheetName) => {
        const data = await this.fetch<{ values?: string[][] }>(
          `/values/${encodeURIComponent(sheetName)}?valueRenderOption=UNFORMATTED_VALUE`,
          "",
        );
        return [sheetName, this.valuesToRows(data.values || [], sheetName)] as const;
      }),
    );

    const sheetData: SheetData = {};
    for (const [sheetName, rows] of results) {
      sheetData[sheetName] = rows;
    }
    return sheetData;
  }

  /** Resolve tab title -> numeric sheetId for every sheet in the spreadsheet. */
  private async getSheetIdMap(): Promise<Record<string, number>> {
    const sheets = await this.fetch<{
      sheets?: { properties?: { title?: string; sheetId?: number } }[];
    }>("/?fields=sheets.properties(title,sheetId)", "");
    const map: Record<string, number> = {};
    for (const sheet of sheets.sheets ?? []) {
      if (sheet.properties?.title && typeof sheet.properties.sheetId === "number") {
        map[sheet.properties.title] = sheet.properties.sheetId;
      }
    }
    return map;
  }

  private valuesToRows(values: string[][], sheetName: string): SheetRow[] {
    if (values.length < 2) return [];

    const headers = values[0] ?? [];
    const rows: SheetRow[] = [];

    for (let i = 1; i < values.length; i++) {
      const row: SheetRow = {};
      const cells = values[i] ?? [];
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? "";
      });
      rows.push(row);
    }

    return rows;
  }

  async writeSheetData(data: SheetData): Promise<void> {
    const sheetIds = await this.getSheetIdMap();

    for (const [sheetName, rows] of Object.entries(data)) {
      const columns = SHEET_COLUMNS[sheetName as keyof typeof SHEET_COLUMNS];
      const targetSheetId = sheetIds[sheetName];
      if (!columns || targetSheetId === undefined) continue;

      const body = rows.map((row) =>
        columns.map((col) => {
          const raw = row[col] ?? "";
          return NUMERIC_COLUMNS.has(col) ? Number(raw) || 0 : String(raw);
        }),
      );

      // Write the header separately, then the rows in bounded chunks. A single
      // batchUpdate carrying every row of every tab produced multi-megabyte
      // request bodies that the Sheets API starts rejecting outright.
      const chunks: (string | number)[][][] = [];
      for (let i = 0; i < body.length; i += WRITE_CHUNK_ROWS) {
        chunks.push(body.slice(i, i + WRITE_CHUNK_ROWS));
      }

      const requests: BatchUpdateRequest[] = [
        {
          updateCells: {
            range: {
              sheetId: targetSheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
            },
            rows: [cellRow(columns.map((col) => col))],
            fields: "userEnteredValue",
          },
        },
      ];

      let startRowIndex = 1;
      for (const chunk of chunks) {
        requests.push({
          updateCells: {
            range: {
              sheetId: targetSheetId,
              startRowIndex,
              endRowIndex: startRowIndex + chunk.length,
              startColumnIndex: 0,
            },
            rows: chunk.map(cellRow),
            fields: "userEnteredValue",
          },
        });
        startRowIndex += chunk.length;
      }

      await this.fetch<{ replies?: unknown[] }>("/:batchUpdate", "", { requests });

      // Drop rows left over from a previous, larger export so the tab does not
      // keep showing stale records below the freshly written block.
      const written = startRowIndex;
      const lastRow = await this.findLastRowIndex(sheetName, columns.length);
      if (lastRow + 1 > written) {
        await this.fetch<{ replies?: unknown[] }>("/:batchUpdate", "", {
          requests: [
            {
              deleteRange: {
                range: {
                  sheetId: targetSheetId,
                  startRowIndex: written,
                  endRowIndex: lastRow + 1,
                  startColumnIndex: 0,
                  endColumnIndex: columns.length,
                },
                shiftDimension: "ROWS",
              },
            } as BatchUpdateRequest,
          ],
        });
      }
    }
  }

  /** Row index of the last row with content in a tab, or -1 when it is empty. */
  private async findLastRowIndex(sheetName: string, _columnCount?: number): Promise<number> {
    const meta = await this.fetch<{ values?: unknown[][] }>(
      `/values/${encodeURIComponent(sheetName)}?valueRenderOption=UNFORMATTED_VALUE`,
      "",
    );
    return (meta.values?.length ?? 0) - 1;
  }

  async ensureSheetsExist(): Promise<void> {
    // Check if sheets exist, create if not
    const sheets = await this.fetch<{ sheets?: { properties?: { title?: string } }[] }>(
      "/?fields=sheets.properties.title",
      "",
    );
    const existingSheets = (sheets.sheets || []).map((s) => s.properties?.title);

    const missingSheets = Object.values(SHEET_NAMES).filter(
      (name) => !existingSheets?.includes(name),
    );

    if (missingSheets.length > 0) {
      await this.fetch<{ replies?: unknown[] }>("/:batchUpdate", "", {
        requests: missingSheets.map((sheetName) => ({
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        })),
      });
    }
  }
}

export const sheetsService = new GoogleSheetsService();
