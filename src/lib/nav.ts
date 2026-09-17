import {
  BarChart3,
  LayoutDashboard,
  Landmark,
  MonitorSmartphone,
  Receipt,
  Settings,
  Target,
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
  { href: "/leads", label: "Leads", shortLabel: "Leads", icon: Target, primary: false },
  { href: "/payments", label: "Payments", shortLabel: "Payments", icon: Wallet, primary: true },
  { href: "/expenses", label: "Monthly Expenses", shortLabel: "Expenses", icon: Receipt, primary: true },
  { href: "/loans", label: "Loans", shortLabel: "Loans", icon: Landmark, primary: false },
  { href: "/assets", label: "Assets", shortLabel: "Assets", icon: MonitorSmartphone, primary: false },
  { href: "/analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3, primary: false },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings, primary: false },
];

/** Everything the phone's bottom bar cannot fit, shown behind "More". */
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.primary);

/** `/clients/abc` should still light up the Clients entry. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
