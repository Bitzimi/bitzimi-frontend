import { useLocation, useNavigate, Link } from "react-router";
import { Bell, ChevronRight, ExternalLink, LogOut, Menu, User } from "lucide-react";
import { useIdentity } from "../../contexts/IdentityContext";
import { useAdminAccess } from "../hooks/useAdminAccess";
import { useNotifications } from "../../contexts/NotificationContext";

// ─── Breadcrumb helper ────────────────────────────────────────────────────────

const BREADCRUMB_MAP: Record<string, string> = {
  admin: "Admin",
  users: "Users",
  kyc: "KYC Review",
  financial: "Financial",
  withdrawals: "Withdrawals",
  deposits: "Deposits",
  transactions: "Transactions",
  tasks: "Tasks",
  pending: "Pending Approval",
  marketplace: "Marketplace",
  proofs: "Proof Review",
  games: "Games",
  vip: "VIP Members",
  referrals: "Referrals & Affiliates",
  notifications: "Notifications",
  "audit-log": "Audit Log",
  settings: "Settings",
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: BREADCRUMB_MAP[seg] ?? seg,
    path: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin:    { label: "Super Admin",  color: "text-indigo-300 bg-indigo-500/15 border-indigo-500/25" },
  finance_admin:  { label: "Finance",      color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25" },
  support_admin:  { label: "Support",      color: "text-sky-300 bg-sky-500/15 border-sky-500/25" },
  moderator_admin:{ label: "Moderator",    color: "text-amber-300 bg-amber-500/15 border-amber-500/25" },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminHeaderProps {
  sidebarCollapsed: boolean;
  onMobileMenuOpen: () => void;
}

export function AdminHeader({ sidebarCollapsed, onMobileMenuOpen }: AdminHeaderProps) {
  const { identity } = useIdentity();
  const { role } = useAdminAccess();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();

  const roleMeta = role ? ROLE_LABELS[role] : null;

  return (
    <header className="fixed top-0 right-0 z-20 h-16 bg-[#09090b]/80 backdrop-blur-md border-b border-white/[0.06] flex items-center px-4 sm:px-6 gap-4"
      style={{ left: sidebarCollapsed ? "64px" : "256px", transition: "left 300ms ease" }}>

      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <Menu className="w-4.5 h-4.5" />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex-1 hidden sm:flex items-center gap-1.5 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.path} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
            {crumb.isLast ? (
              <span className="text-sm font-medium text-white truncate">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="flex-1 sm:flex-none" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* View platform link */}
        <Link
          to="/wallet"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Platform
        </Link>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-[#09090b]" />
          )}
        </button>

        {/* User info */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-white/[0.06]">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-indigo-300">
              {identity.avatar.length === 1 ? identity.avatar : <User className="w-3.5 h-3.5" />}
            </span>
          </div>

          {/* Name + role (desktop) */}
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-medium text-white leading-none truncate max-w-[120px]">
              {identity.username || "Admin"}
            </p>
            {roleMeta && (
              <span className={`mt-0.5 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => navigate("/wallet")}
            title="Back to platform"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
