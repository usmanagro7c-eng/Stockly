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
}

export const primaryNav: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/buy", label: "Buy", icon: ShoppingCart },
  { to: "/sell", label: "Sell", icon: Tag },
  { to: "/stock", label: "Stock", icon: Boxes },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export const moreNav: NavItem[] = [
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/history", label: "History", icon: History },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];
