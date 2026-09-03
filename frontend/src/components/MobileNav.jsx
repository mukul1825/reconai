import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { clearToken } from "../api/client";
import { NAV_ITEMS } from "./navItems";

/**
 * Mobile counterpart to Sidebar - not a drawer/hamburger overlay
 * deliberately. A horizontal bar with no open/close state is fewer moving
 * parts to get right under time pressure, and it keeps every destination
 * visible in one glance rather than hidden behind a tap. overflow-x-auto
 * is the safety net if a very narrow screen still can't fit all 4 items.
 */
export default function MobileNav() {
  return (
    <div className="sm:hidden border-b border-line bg-surface sticky top-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div>
          <span className="font-semibold text-[15px] tracking-tight">ReconAI</span>
          <p className="text-xs text-subtle">Reconciliation console</p>
        </div>
        <button
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
          aria-label="Sign out"
          className="text-subtle hover:text-ink transition-colors p-1"
        >
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>

      <nav className="flex overflow-x-auto px-2 py-2 gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "bg-accent-soft text-accent font-medium"
                  : "text-subtle hover:bg-paper hover:text-ink"
              }`
            }
          >
            <Icon size={15} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
