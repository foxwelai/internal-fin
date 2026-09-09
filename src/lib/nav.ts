import {
  BarChart3,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
  /** Shown in the collapsed mobile bar. */
  primary: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", shortLabel: "Overview", icon: LayoutDashboard, primary: true },
  { href: "/clients", label: "Clients & Projects", shortLabel: "Clients", icon: Users, primary: true },
  { href: "/payments", label: "Payments", shortLabel: "Payments", icon: Wallet, primary: true },
  { href: "/expenses", label: "Monthly Expenses", shortLabel: "Expenses", icon: Receipt, primary: true },
  { href: "/analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3, primary: true },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings, primary: false },
];

/** `/clients/abc` should still light up the Clients entry. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
