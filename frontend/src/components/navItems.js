import { Upload, LayoutDashboard, ListChecks, History } from "lucide-react";

export const NAV_ITEMS = [
  { to: "/upload", label: "New batch", icon: Upload },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exceptions", label: "Exceptions", icon: ListChecks },
  { to: "/audit", label: "Audit trail", icon: History },
];
