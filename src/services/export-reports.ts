import * as XLSX from "xlsx";
import type { InventoryItem, Sale, Purchase, Expense, Investment } from "@/types";
import { formatDate, formatMoney } from "@/utils/format";

/**
 * Downloads a binary blob as a named file in the browser.
 */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Downloads a worksheet or workbook as .xlsx
 */
function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, fileName);
}

/**
 * Helper to auto-calculate column widths based on contents.
 */
function autoColWidths(data: any[][]): XLSX.ColInfo[] {
  const maxCols = Math.max(...data.map((r) => r.length), 0);
  const widths: number[] = Array(maxCols).fill(12);

  data.forEach((row) => {
    row.forEach((val, colIdx) => {
      const len = String(val ?? "").length;
      const current = widths[colIdx] ?? 12;
      if (len + 3 > current) {
        widths[colIdx] = Math.min(len + 3, 40);
      }
    });
  });

  return widths.map((w) => ({ wch: w }));
}

/**
 * 1. Stock Inventory Report (.xlsx)
 */
export function exportStockInventoryExcel(
  items: InventoryItem[],
  currency = "Rs.",
  threshold = 5,
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const header = [
    "Item / Model Name",
    "Total Purchased (Qty)",
    "Total Sold (Qty)",
    "Adjusted (Qty)",
    "Available Stock (Qty)",
    `Avg Unit Cost (${currency})`,
    `Total Inventory Value (${currency})`,
    "Stock Status",
  ];

  let totalQty = 0;
  let totalValue = 0;

  const rows: any[][] = [header];

  items.forEach((item) => {
    const val = item.remaining * item.avg_cost;
    totalQty += item.remaining;
    totalValue += val;

    let status = "In Stock";
    if (item.remaining <= 0) status = "Out of Stock";
    else if (item.remaining <= threshold) status = "Low Stock";

    rows.push([
      item.model,
      item.bought,
      item.sold,
      item.adjusted,
      item.remaining,
      Math.round(item.avg_cost * 100) / 100,
      Math.round(val * 100) / 100,
      status,
    ]);
  });

  // Summary Row
  rows.push([]);
  rows.push(["TOTALS", "", "", "", totalQty, "", Math.round(totalValue * 100) / 100, ""]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = autoColWidths(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock Inventory");

  downloadWorkbook(wb, `Stockly_Stock_Inventory_${dateStr}.xlsx`);
}

/**
 * 2. Monthly / Filtered Sales Report (.xlsx)
 */
export function exportSalesReportExcel(
  sales: Sale[],
  currency = "Rs.",
  rangeLabel?: string,
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const header = [
    "Date",
    "Record ID",
    "Model / Item",
    "Quantity Sold",
    `Unit Selling Price (${currency})`,
    `Total Sale Revenue (${currency})`,
    `Gross Profit (${currency})`,
    "Customer",
    "Remarks",
  ];

  let totalQty = 0;
  let totalRevenue = 0;
  let totalProfit = 0;

  const rows: any[][] = [header];

  sales.forEach((s) => {
    totalQty += s.quantity;
    totalRevenue += s.total_sale;
    totalProfit += s.profit;

    rows.push([
      s.date,
      s.record_id,
      s.model,
      s.quantity,
      s.selling_price,
      s.total_sale,
      s.profit,
      s.customer || "—",
      s.remarks || "—",
    ]);
  });

  // Summary Row
  rows.push([]);
  rows.push([
    "TOTALS",
    "",
    "",
    totalQty,
    "",
    Math.round(totalRevenue * 100) / 100,
    Math.round(totalProfit * 100) / 100,
    "",
    rangeLabel ? `Period: ${rangeLabel}` : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = autoColWidths(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

  downloadWorkbook(wb, `Stockly_Sales_Report_${dateStr}.xlsx`);
}

/**
 * 3. Expenses Report (.xlsx)
 */
export function exportExpensesReportExcel(
  expenses: Expense[],
  currency = "Rs.",
  rangeLabel?: string,
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const header = [
    "Date",
    "Record ID",
    "Expense Category",
    `Amount (${currency})`,
    "Description / Remarks",
  ];

  let totalAmount = 0;
  const rows: any[][] = [header];

  expenses.forEach((e) => {
    totalAmount += e.amount;
    rows.push([e.date, e.record_id, e.expense_type, e.amount, e.remarks || "—"]);
  });

  // Summary Row
  rows.push([]);
  rows.push([
    "TOTAL EXPENSES",
    "",
    "",
    Math.round(totalAmount * 100) / 100,
    rangeLabel ? `Period: ${rangeLabel}` : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = autoColWidths(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");

  downloadWorkbook(wb, `Stockly_Expenses_Report_${dateStr}.xlsx`);
}

/**
 * 4. Complete Business Master Workbook (Multi-Tab .xlsx)
 */
export function exportCompleteBusinessWorkbook(
  data: {
    inventory: InventoryItem[];
    sales: Sale[];
    purchases: Purchase[];
    expenses: Expense[];
    investments?: Investment[];
  },
  currency = "Rs.",
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();

  // Tab 1: Inventory
  const invRows: any[][] = [
    [
      "Item / Model",
      "Bought (Qty)",
      "Sold (Qty)",
      "Remaining Stock",
      `Avg Unit Cost (${currency})`,
      `Stock Value (${currency})`,
    ],
  ];
  data.inventory.forEach((i) =>
    invRows.push([
      i.model,
      i.bought,
      i.sold,
      i.remaining,
      i.avg_cost,
      i.remaining * i.avg_cost,
    ]),
  );
  const wsInv = XLSX.utils.aoa_to_sheet(invRows);
  wsInv["!cols"] = autoColWidths(invRows);
  XLSX.utils.book_append_sheet(wb, wsInv, "Inventory");

  // Tab 2: Sales
  const salesRows: any[][] = [
    [
      "Date",
      "ID",
      "Model",
      "Qty",
      `Selling Price (${currency})`,
      `Revenue (${currency})`,
      `Gross Profit (${currency})`,
      "Customer",
    ],
  ];
  data.sales.forEach((s) =>
    salesRows.push([
      s.date,
      s.record_id,
      s.model,
      s.quantity,
      s.selling_price,
      s.total_sale,
      s.profit,
      s.customer,
    ]),
  );
  const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
  wsSales["!cols"] = autoColWidths(salesRows);
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales");

  // Tab 3: Purchases
  const buyRows: any[][] = [
    [
      "Date",
      "ID",
      "Model",
      "Qty",
      `Buying Price (${currency})`,
      `Total Cost (${currency})`,
      "Supplier",
    ],
  ];
  data.purchases.forEach((p) =>
    buyRows.push([
      p.date,
      p.record_id,
      p.model,
      p.quantity,
      p.buying_price,
      p.total_cost,
      p.supplier,
    ]),
  );
  const wsBuy = XLSX.utils.aoa_to_sheet(buyRows);
  wsBuy["!cols"] = autoColWidths(buyRows);
  XLSX.utils.book_append_sheet(wb, wsBuy, "Purchases");

  // Tab 4: Expenses
  const expRows: any[][] = [
    ["Date", "ID", "Category", `Amount (${currency})`, "Remarks"],
  ];
  data.expenses.forEach((e) =>
    expRows.push([e.date, e.record_id, e.expense_type, e.amount, e.remarks]),
  );
  const wsExp = XLSX.utils.aoa_to_sheet(expRows);
  wsExp["!cols"] = autoColWidths(expRows);
  XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");

  // Tab 5: Investments
  if (data.investments && data.investments.length > 0) {
    const invstRows: any[][] = [
      ["Date", "ID", "Investor", `Amount (${currency})`, "Type", "Remarks"],
    ];
    data.investments.forEach((inv) =>
      invstRows.push([
        inv.date,
        inv.record_id,
        inv.investor,
        inv.amount,
        inv.type,
        inv.remarks,
      ]),
    );
    const wsInvst = XLSX.utils.aoa_to_sheet(invstRows);
    wsInvst["!cols"] = autoColWidths(invstRows);
    XLSX.utils.book_append_sheet(wb, wsInvst, "Capital & Investments");
  }

  downloadWorkbook(wb, `Stockly_Master_Business_Report_${dateStr}.xlsx`);
}

/**
 * 5. Clean UTF-8 CSV Export
 */
export function exportToCSV(fileName: string, headers: string[], rows: (string | number)[][]) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  // UTF-8 BOM so Excel opens Urdu / special characters properly
  lines.push(
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
  );

  rows.forEach((row) => {
    lines.push(
      row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","),
    );
  });

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, `${fileName}_${dateStr}.csv`);
}

/**
 * 6. Printable High-Resolution PDF Report
 * Opens a dedicated print preview with clean A4 print styling and triggers print/save-as-pdf.
 */
export function printSalesReportPDF(config: {
  shopName?: string;
  userName?: string;
  dateRange?: string;
  currency: string;
  metrics: {
    totalSales: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    itemsSold: number;
  };
  sales: Sale[];
}) {
  const { shopName, userName, dateRange, currency, metrics, sales } = config;
  const printDate = new Date().toLocaleString();

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate and print PDF reports.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales & Financial Report — ${shopName || "Stockly"}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 13px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .brand h1 {
      margin: 0;
      font-size: 24px;
      color: #059669;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .brand p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }
    .meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .meta strong {
      color: #0f172a;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .kpi-card.highlight {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }
    .kpi-title {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .kpi-val {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
    }
    .kpi-val.green {
      color: #059669;
    }
    .kpi-val.red {
      color: #dc2626;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 10px;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      text-align: left;
      padding: 8px 10px;
      font-weight: 700;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .text-right {
      text-align: right;
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    .footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    .print-actions {
      margin-bottom: 16px;
      display: flex;
      gap: 10px;
    }
    .btn {
      background: #059669;
      color: white;
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    @media print {
      .print-actions {
        display: none !important;
      }
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
  </div>

  <div class="header">
    <div class="brand">
      <h1>${shopName || "Stockly Pro"}</h1>
      <p>Financial Sales & Profit Report</p>
    </div>
    <div class="meta">
      <div><strong>Period:</strong> ${dateRange || "All Recorded History"}</div>
      <div><strong>Generated:</strong> ${printDate}</div>
      ${userName ? `<div><strong>Prepared by:</strong> ${userName}</div>` : ""}
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Revenue</div>
      <div class="kpi-val num">${formatMoney(metrics.totalSales, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Gross Profit</div>
      <div class="kpi-val num green">+${formatMoney(metrics.totalProfit, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Expenses</div>
      <div class="kpi-val num red">-${formatMoney(metrics.totalExpenses, currency)}</div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-title">Net Profit</div>
      <div class="kpi-val num green">${formatMoney(metrics.netProfit, currency)}</div>
    </div>
  </div>

  <h2>Itemized Sales History (${sales.length} transactions)</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Record ID</th>
        <th>Model / Product</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total Sale</th>
        <th class="text-right">Profit</th>
        <th>Customer</th>
      </tr>
    </thead>
    <tbody>
      ${sales
        .map(
          (s) => `
        <tr>
          <td>${formatDate(s.date)}</td>
          <td><span style="color:#64748b; font-size:11px">${s.record_id}</span></td>
          <td><strong>${s.model}</strong></td>
          <td class="text-right num">${s.quantity}</td>
          <td class="text-right num">${formatMoney(s.selling_price, currency)}</td>
          <td class="text-right num"><strong>${formatMoney(s.total_sale, currency)}</strong></td>
          <td class="text-right num" style="color:#059669">+${formatMoney(s.profit, currency)}</td>
          <td>${s.customer || "—"}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1">
        <td colspan="3">SUMMARY TOTALS</td>
        <td class="text-right num">${metrics.itemsSold}</td>
        <td></td>
        <td class="text-right num">${formatMoney(metrics.totalSales, currency)}</td>
        <td class="text-right num" style="color:#059669">+${formatMoney(metrics.totalProfit, currency)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Generated by Stockly — Inventory & Profit Manager</div>
    <div>Page 1 of 1 • Official Business Record</div>
  </div>

  <script>
    // Automatically open print dialog after brief rendering delay
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
