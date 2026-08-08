import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  LayoutDashboard, Users, ShieldCheck, ArrowDownToLine,
  ArrowUpFromLine, ListOrdered, ClipboardCheck, Store, FileCheck,
  Gamepad2, Crown, Share2, Bell, Settings, ScrollText,
  ChevronRight, ChevronLeft, ChevronDown, Zap, BarChart3,
  BookOpen, FileText, Type, TrendingUp, BrainCircuit,
  Shield, AlertTriangle, LogIn, Monitor, Globe, AlertOctagon,
  Trophy, Swords, Star, Award, Coins, Megaphone, Gavel, DollarSign, Wallet,
} from "lucide-react";
import { useAdminAccess } from "../hooks/useAdminAccess";
import type { Permission } from "../types/index";

// ─── Nav Definition ───────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  permission: Permission;
  badge?: number;
  end?: boolean;
  children?: Omit<NavItem, "children">[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/admin",
        icon: LayoutDashboard,
        permission: "admin.dashboard.view",
        end: true,
      },
      {
        id: "analytics",
        label: "Analytics",
        path: "/admin/analytics",
        icon: TrendingUp,
        permission: "admin.analytics.view",
      },
    ],
  },
  {
    label: "Users",
    items: [
      {
        id: "users",
        label: "All Users",
        path: "/admin/users",
        icon: Users,
        permission: "admin.users.view",
      },
      {
        id: "kyc",
        label: "KYC Review",
        path: "/admin/kyc",
        icon: ShieldCheck,
        permission: "admin.kyc.view",
      },
    ],
  },
  {
    label: "Financial",
    items: [
      {
        id: "withdrawals",
        label: "Withdrawals",
        path: "/admin/financial/withdrawals",
        icon: ArrowUpFromLine,
        permission: "admin.financial.process_withdrawals",
      },
      {
        id: "deposits",
        label: "Deposits",
        path: "/admin/financial/deposits",
        icon: ArrowDownToLine,
        permission: "admin.financial.confirm_deposits",
      },
      {
        id: "transactions",
        label: "Transactions",
        path: "/admin/financial/transactions",
        icon: ListOrdered,
        permission: "admin.financial.transactions.view",
      },
      {
        id: "wallets",
        label: "Wallet Management",
        path: "/admin/financial/wallets",
        icon: Wallet,
        permission: "admin.wallets.view",
      },
    ],
  },
  {
    label: "Task Marketplace",
    items: [
      {
        id: "tasks-dashboard",
        label: "Task Management",
        path: "/admin/tasks",
        icon: BarChart3,
        permission: "admin.tasks.view",
        end: true,
      },
      {
        id: "tasks-pending",
        label: "Pending Approval",
        path: "/admin/tasks/pending",
        icon: ClipboardCheck,
        permission: "admin.tasks.approve",
      },
      {
        id: "tasks-marketplace",
        label: "All Tasks",
        path: "/admin/tasks/marketplace",
        icon: Store,
        permission: "admin.tasks.view",
      },
      {
        id: "tasks-proofs",
        label: "Proof Review",
        path: "/admin/tasks/proofs",
        icon: FileCheck,
        permission: "admin.tasks.proofs.view",
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        id: "games",
        label: "Games",
        path: "/admin/games",
        icon: Gamepad2,
        permission: "admin.games.view",
      },
      {
        id: "football",
        label: "Football AI Hub",
        path: "/admin/football",
        icon: Trophy,
        permission: "admin.football.view",
        children: [
          { id: "football-leagues",     label: "Leagues",     path: "/admin/football/leagues",     icon: Globe,      permission: "admin.football.view"   },
          { id: "football-matches",     label: "Matches",     path: "/admin/football/matches",     icon: Swords,     permission: "admin.football.view"   },
          { id: "football-predictions", label: "Predictions", path: "/admin/football/predictions", icon: TrendingUp, permission: "admin.football.manage" },
          { id: "football-results",     label: "Results",     path: "/admin/football/results",     icon: Trophy,     permission: "admin.football.manage" },
        ],
      },
      {
        id: "vip",
        label: "VIP Members",
        path: "/admin/vip",
        icon: Crown,
        permission: "admin.vip.view",
      },
      {
        id: "referrals",
        label: "Referrals & Affiliates",
        path: "/admin/referrals",
        icon: Share2,
        permission: "admin.referrals.view",
      },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        id: "ambassadors",
        label: "Ambassador Program",
        path: "/admin/ambassadors",
        icon: Star,
        permission: "admin.ambassadors.view",
      },
      {
        id: "challenges",
        label: "Monthly Challenge",
        path: "/admin/challenges",
        icon: Award,
        permission: "admin.challenges.view",
      },
      {
        id: "football-points",
        label: "Football Points",
        path: "/admin/football/points",
        icon: Coins,
        permission: "admin.football.view",
      },
      {
        id: "promotions",
        label: "Promotions",
        path: "/admin/promotions",
        icon: Megaphone,
        permission: "admin.promotions.view",
      },
      {
        id: "auctions",
        label: "Auction Marketplace",
        path: "/admin/auctions",
        icon: Gavel,
        permission: "admin.auction.view",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        id: "content",
        label: "Content Library",
        path: "/admin/content",
        icon: BookOpen,
        permission: "admin.content.view",
      },
      {
        id: "pages",
        label: "Static Pages",
        path: "/admin/pages",
        icon: FileText,
        permission: "admin.pages.view",
      },
      {
        id: "text",
        label: "Platform Text",
        path: "/admin/text",
        icon: Type,
        permission: "admin.text.view",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "notifications",
        label: "Notifications",
        path: "/admin/notifications",
        icon: Bell,
        permission: "admin.notifications.view",
      },
      {
        id: "security",
        label: "Security",
        path: "/admin/security",
        icon: Shield,
        permission: "admin.security.view",
        children: [
          { id: "security-events",  label: "Security Events",  path: "/admin/security/events",        icon: AlertTriangle, permission: "admin.security.view" },
          { id: "login-history",    label: "Login History",    path: "/admin/security/login-history",  icon: LogIn,         permission: "admin.security.view" },
          { id: "sessions",         label: "Sessions",         path: "/admin/security/sessions",       icon: Monitor,       permission: "admin.security.view" },
          { id: "ip-controls",      label: "IP Controls",      path: "/admin/security/ip-controls",    icon: Globe,         permission: "admin.security.manage" },
          { id: "fraud-alerts",     label: "Fraud Alerts",     path: "/admin/security/fraud-alerts",   icon: AlertOctagon,  permission: "admin.security.view" },
          { id: "compliance",       label: "Compliance",       path: "/admin/security/compliance",     icon: FileText,      permission: "admin.security.view" },
        ],
      },
      {
        id: "audit",
        label: "Audit Log",
        path: "/admin/audit-log",
        icon: ScrollText,
        permission: "admin.audit.view",
      },
      {
        id: "currency",
        label: "Currency",
        path: "/admin/currency",
        icon: DollarSign,
        permission: "admin.config.view",
      },
      {
        id: "languages",
        label: "Languages",
        path: "/admin/languages",
        icon: Globe,
        permission: "admin.config.view",
      },
      {
        id: "translations",
        label: "Translations",
        path: "/admin/translations",
        icon: Type,
        permission: "admin.config.view",
      },
      {
        id: "features",
        label: "Feature Management",
        path: "/admin/features",
        icon: Zap,
        permission: "admin.config.view",
      },
      {
        id: "branding",
        label: "Branding",
        path: "/admin/branding",
        icon: Star,
        permission: "admin.config.edit",
      },
      {
        id: "settings",
        label: "Settings",
        path: "/admin/settings",
        icon: Settings,
        permission: "admin.settings.view",
      },
      {
        id: "developer",
        label: "AI Developer Center",
        path: "/admin/developer",
        icon: BrainCircuit,
        permission: "admin.developer.view",
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const { can } = useAdminAccess();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(NAV_GROUPS.map(g => g.label))
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    if (collapsed) return;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    if (collapsed) return;
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full z-30 flex flex-col
        bg-[#111115] border-r border-white/[0.06]
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-16" : "w-64"}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-white/[0.06] flex-shrink-0 ${collapsed ? "px-4 justify-center" : "px-5 gap-3"}`}>
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-tight">Bitzimi</p>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Admin</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 scrollbar-thin">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(item => can(item.permission));
          if (visibleItems.length === 0) return null;

          const isGroupExpanded = collapsed || expandedGroups.has(group.label);

          return (
            <div key={group.label} className="px-2">
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1.5 mb-0.5 group"
                >
                  <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase group-hover:text-zinc-400 transition-colors">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-zinc-600 group-hover:text-zinc-500 transition-all ${isGroupExpanded ? "" : "-rotate-90"}`}
                  />
                </button>
              )}

              {isGroupExpanded && (
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item.path, item.end);
                    const hasChildren = item.children && item.children.length > 0;
                    const isItemExpanded = expandedItems.has(item.id) || (hasChildren && item.children!.some(c => isActive(c.path)));

                    if (hasChildren) {
                      const visibleChildren = item.children!.filter(c => can(c.permission));
                      if (visibleChildren.length === 0) return null;
                      return (
                        <div key={item.id}>
                          <button
                            onClick={() => collapsed
                              ? undefined
                              : toggleItem(item.id)}
                            title={collapsed ? item.label : undefined}
                            className={`
                              relative w-full flex items-center rounded-lg px-2.5 py-2 text-sm font-medium
                              transition-all duration-150 group
                              ${active ? "text-indigo-300" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"}
                              ${collapsed ? "justify-center" : "gap-2.5"}
                            `}
                          >
                            <Icon className={`flex-shrink-0 ${collapsed ? "w-4.5 h-4.5" : "w-4 h-4"} ${active ? "text-indigo-400" : ""}`} />
                            {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                            {!collapsed && (
                              <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isItemExpanded ? "" : "-rotate-90"}`} />
                            )}
                            {collapsed && (
                              <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                {item.label}
                              </div>
                            )}
                          </button>
                          {!collapsed && isItemExpanded && (
                            <div className="ml-3 pl-3 border-l border-white/[0.08] space-y-0.5 mt-0.5">
                              {visibleChildren.map(child => {
                                const ChildIcon = child.icon;
                                const childActive = isActive(child.path, child.end);
                                return (
                                  <NavLink
                                    key={child.id}
                                    to={child.path}
                                    end={!!child.end}
                                    className={`
                                      relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium
                                      transition-all duration-150
                                      ${childActive ? "bg-indigo-600/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"}
                                    `}
                                  >
                                    {childActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-indigo-500 rounded-r-full" />}
                                    <ChildIcon className={`flex-shrink-0 w-3.5 h-3.5 ${childActive ? "text-indigo-400" : ""}`} />
                                    <span className="flex-1 truncate">{child.label}</span>
                                  </NavLink>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        end={!!item.end}
                        title={collapsed ? item.label : undefined}
                        className={`
                          relative flex items-center rounded-lg px-2.5 py-2 text-sm font-medium
                          transition-all duration-150 group
                          ${active
                            ? "bg-indigo-600/15 text-indigo-300"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                          }
                          ${collapsed ? "justify-center" : "gap-2.5"}
                        `}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full" />
                        )}

                        <Icon className={`flex-shrink-0 ${collapsed ? "w-4.5 h-4.5" : "w-4 h-4"} ${active ? "text-indigo-400" : ""}`} />

                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}

                        {!collapsed && item.badge !== undefined && item.badge > 0 && (
                          <span className="ml-auto flex-shrink-0 h-4.5 min-w-[18px] px-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold flex items-center justify-center">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}

                        {collapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                            {item.label}
                          </div>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="flex-shrink-0 p-2 border-t border-white/[0.06]">
        <button
          onClick={onToggle}
          className={`
            w-full flex items-center rounded-lg px-2.5 py-2 text-zinc-500
            hover:text-zinc-300 hover:bg-white/[0.04] transition-all text-sm
            ${collapsed ? "justify-center" : "gap-2.5"}
          `}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium">Collapse</span>
              </>
          }
        </button>
      </div>
    </aside>
  );
}
