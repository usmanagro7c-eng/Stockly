export interface Purchase {
  record_id: string;
  date: string;
  model: string;
  quantity: number;
  buying_price: number;
  total_cost: number;
  supplier: string;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface Sale {
  record_id: string;
  date: string;
  model: string;
  quantity: number;
  selling_price: number;
  total_sale: number;
  profit: number;
  customer: string;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface Expense {
  record_id: string;
  date: string;
  expense_type: string;
  amount: number;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export type AdjustmentType = "Found Stock (+)" | "Damaged (-)" | "Lost (-)" | "Correction";

export interface Adjustment {
  record_id: string;
  date: string;
  model: string;
  quantity: number;
  type: AdjustmentType;
  reason: string;
  created_by: string;
  created_at: string;
}

export type ChangeAction = "ADD" | "EDIT" | "DELETE" | "IMPORT" | "EXPORT" | "SYNC";
export type ChangeSection = "BUY" | "SELL" | "EXPENSE" | "STOCK_ADJUSTMENT" | "INVESTMENT";

export type InvestmentType =
  | "Capital Injection"
  | "Partner Contribution"
  | "Loan / Borrowing"
  | "Drawings / Withdrawal";

export interface Investment {
  record_id: string;
  date: string;
  investor: string;
  amount: number;
  type: InvestmentType;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface ChangeLog {
  change_id: string;
  timestamp: string;
  user: string;
  device_id: string;
  action: ChangeAction;
  section: ChangeSection;
  record_id: string;
  model: string;
  quantity: number;
  old_value: string;
  new_value: string;
  remarks: string;
}

export interface Settings {
  user_name: string;
  device_id: string;
  currency_symbol: string;
  low_stock_threshold: number;
  pin_code_hash: string;
  linked_file_name: string;
  last_sync_time: string;
}

export interface InventoryItem {
  model: string;
  bought: number;
  sold: number;
  adjusted: number;
  remaining: number;
  avg_cost: number;
  latest_buy_price: number;
  latest_sell_price: number;
  total_investment: number;
  total_sales: number;
  gross_profit: number;
  estimated_value: number;
  status: "IN STOCK" | "LOW STOCK" | "OUT OF STOCK";
}

export interface DashboardMetrics {
  total_stock_units: number;
  unique_models_in_stock: number;
  total_investment: number;
  total_sales_revenue: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  low_stock_count: number;
}

export interface BackupFile {
  app: string;
  version: number;
  exported_at: string;
  settings: Partial<Settings>;
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  adjustments: Adjustment[];
  changelogs: ChangeLog[];
  investments?: Investment[];
}

export const INVESTMENT_TYPES: InvestmentType[] = [
  "Capital Injection",
  "Partner Contribution",
  "Loan / Borrowing",
  "Drawings / Withdrawal",
];

export const EXPENSE_CATEGORIES = [
  "Delivery",
  "Transport",
  "Packaging",
  "Repair",
  "Rent",
  "Utilities",
  "Salary",
  "Miscellaneous",
] as const;

export const ADJUSTMENT_TYPES: AdjustmentType[] = [
  "Found Stock (+)",
  "Damaged (-)",
  "Lost (-)",
  "Correction",
];
