import {
  Activity,
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
  color?: string;
}

export const primaryNav: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard, description: "Overview & metrics" },
  { to: "/buy", label: "Buy", icon: ShoppingCart, description: "Record purchases" },
  { to: "/sell", label: "Sell", icon: Tag, description: "Point of sale" },
  { to: "/stock", label: "Stock", icon: Boxes, description: "Inventory levels" },
];

export const analyticsNav: NavItem[] = [
  { to: "/reports", label: "Reports", icon: BarChart3, description: "Analytics & P&L", color: "from-blue-500/20 to-indigo-500/10 text-blue-400" },
  { to: "/expenses", label: "Expenses", icon: Receipt, description: "Shop overheads", color: "from-amber-500/20 to-orange-500/10 text-amber-400" },
  { to: "/history", label: "History", icon: History, description: "Audit timeline", color: "from-purple-500/20 to-pink-500/10 text-purple-400" },
  { to: "/activity", label: "Activity", icon: Activity, description: "System changelog", color: "from-emerald-500/20 to-teal-500/10 text-emerald-400" },
];

export const systemNav: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Settings, description: "Sheets, PIN & backup", color: "from-slate-500/20 to-zinc-500/10 text-slate-300" },
];

export const moreNav: NavItem[] = [...analyticsNav, ...systemNav];
