import { NavLink } from "react-router-dom";
import { Upload, LayoutDashboard, ListChecks, History, LogOut } from "lucide-react";
import { clearToken } from "../api/client";

const NAV_ITEMS = [
  { to: "/upload", label: "New batch", icon: Upload },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/exceptions", label: "Exceptions", icon: ListChecks },
  { to: "/audit", label: "Audit trail", icon: History },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-line bg-surface flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-line">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[15px] tracking-tight">ReconAI</span>
        </div>
        <p className="text-xs text-subtle mt-0.5">Reconciliation console</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? "bg-accent-soft text-accent font-medium"
                  : "text-subtle hover:bg-paper hover:text-ink"
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-line">
        <button
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-subtle hover:bg-paper hover:text-ink w-full transition-colors"
        >
          <LogOut size={16} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
