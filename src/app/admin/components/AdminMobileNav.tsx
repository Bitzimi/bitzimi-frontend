import { NavLink, useLocation } from "react-router";
import { X, LayoutDashboard, Users, ShieldCheck, Wallet, ArrowDownToLine, ArrowUpFromLine,
  ListOrdered, ClipboardCheck, Store, FileCheck, Gamepad2, Crown,
  Share2, Bell, Settings, ScrollText, Zap, BookOpen, FileText, Type, TrendingUp, DollarSign, Globe, Star } from "lucide-react";
import { useAdminAccess } from "../hooks/useAdminAccess";
import { useIdentity } from "../../contexts/IdentityContext";
import type { Permission } from "../types/index";

const NAV_FLAT: Array<{ id: string; label: string; path: string; icon: React.ElementType; permission: Permission; group: string }> = [
  { id: "dashboard",     label: "Dashboard",            path: "/admin",                          icon: LayoutDashboard,  permission: "admin.dashboard.view",               group: "Overview" },
  { id: "analytics",    label: "Analytics",            path: "/admin/analytics",                icon: TrendingUp,       permission: "admin.analytics.view",               group: "Overview" },
  { id: "users",         label: "All Users",            path: "/admin/users",                    icon: Users,            permission: "admin.users.view",                   group: "Users" },
  { id: "kyc",           label: "KYC Review",           path: "/admin/kyc",                      icon: ShieldCheck,      permission: "admin.kyc.view",                     group: "Users" },
  { id: "withdrawals",   label: "Withdrawals",          path: "/admin/financial/withdrawals",    icon: ArrowUpFromLine,  permission: "admin.financial.process_withdrawals", group: "Financial" },
  { id: "deposits",      label: "Deposits",             path: "/admin/financial/deposits",       icon: ArrowDownToLine,  permission: "admin.financial.confirm_deposits",    group: "Financial" },
  { id: "transactions",  label: "Transactions",         path: "/admin/financial/transactions",   icon: ListOrdered,      permission: "admin.financial.transactions.view",   group: "Financial" },
  { id: "tasks-pending", label: "Pending Approval",     path: "/admin/tasks/pending",            icon: ClipboardCheck,   permission: "admin.tasks.approve",                group: "Tasks" },
  { id: "tasks-all",     label: "All Tasks",            path: "/admin/tasks/marketplace",        icon: Store,            permission: "admin.tasks.view",                   group: "Tasks" },
  { id: "tasks-proofs",  label: "Proof Review",         path: "/admin/tasks/proofs",             icon: FileCheck,        permission: "admin.tasks.proofs.view",             group: "Tasks" },
  { id: "games",         label: "Games",                path: "/admin/games",                    icon: Gamepad2,         permission: "admin.games.view",                   group: "Platform" },
  { id: "vip",           label: "VIP Members",          path: "/admin/vip",                      icon: Crown,            permission: "admin.vip.view",                     group: "Platform" },
  { id: "referrals",     label: "Referrals & Affiliates", path: "/admin/referrals",              icon: Share2,           permission: "admin.referrals.view",               group: "Platform" },
  { id: "content",       label: "Content Library",      path: "/admin/content",                  icon: BookOpen,         permission: "admin.content.view",                 group: "Content" },
  { id: "pages",         label: "Static Pages",         path: "/admin/pages",                    icon: FileText,         permission: "admin.pages.view",                   group: "Content" },
  { id: "text",          label: "Platform Text",        path: "/admin/text",                     icon: Type,             permission: "admin.text.view",                    group: "Content" },
  { id: "notifications", label: "Notifications",        path: "/admin/notifications",            icon: Bell,             permission: "admin.notifications.view",           group: "System" },
  { id: "audit",         label: "Audit Log",            path: "/admin/audit-log",                icon: ScrollText,       permission: "admin.audit.view",                   group: "System" },
  { id: "currency",      label: "Currency",             path: "/admin/currency",                 icon: DollarSign,       permission: "admin.config.view",                  group: "System" },
  { id: "languages",    label: "Languages",            path: "/admin/languages",                icon: Globe,            permission: "admin.config.view",                  group: "System" },
  { id: "translations", label: "Translations",         path: "/admin/translations",             icon: Type,             permission: "admin.config.view",                  group: "System" },
  { id: "features",     label: "Feature Management",   path: "/admin/features",                 icon: Zap,              permission: "admin.config.view",                  group: "System" },
  { id: "branding",     label: "Branding",             path: "/admin/branding",                 icon: Star,             permission: "admin.config.edit",                  group: "System" },
  { id: "settings",      label: "Settings",             path: "/admin/settings",                 icon: Settings,         permission: "admin.settings.view",                group: "System" },
];

interface AdminMobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function AdminMobileNav({ open, onClose }: AdminMobileNavProps) {
  const { can } = useAdminAccess();
  const { identity } = useIdentity();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const visibleItems = NAV_FLAT.filter(item => can(item.permission));
  const groups = [...new Set(visibleItems.map(i => i.group))];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#111115] border-r border-white/[0.06] flex flex-col lg:hidden animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Bitzimi</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Admin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-indigo-300">{identity.avatar}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{identity.username}</p>
              <p className="text-xs text-zinc-500 truncate">{identity.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {groups.map(group => {
            const groupItems = visibleItems.filter(i => i.group === group);
            return (
              <div key={group} className="mb-4">
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {groupItems.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        end={item.path === "/admin"}
                        onClick={onClose}
                        className={`
                          relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                          transition-all
                          ${active
                            ? "bg-indigo-600/15 text-indigo-300"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                          }
                        `}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full" />
                        )}
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-indigo-400" : ""}`} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
