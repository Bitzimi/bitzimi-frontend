import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Users, ShieldCheck, Crown, Phone, Search, ChevronRight, RefreshCw, Ban } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  adminUserService, adminStatsService, EMPTY_STATS,
  type AdminUserSnapshot, type AdminStats,
} from "../../services/adminDataService";

const LIMIT = 50;

export default function UsersPage() {
  const navigate = useNavigate();

  const [items, setItems]           = useState<AdminUserSnapshot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(false);
  const [search, setSearch]         = useState("");
  const [stats, setStats]           = useState<AdminStats>(EMPTY_STATS);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (searchVal: string, cursor?: string) => {
    if (!cursor) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await adminUserService.fetchUsers({ search: searchVal || undefined, cursor, limit: LIMIT });
      if (cursor) {
        setItems(prev => [...prev, ...res.items]);
      } else {
        setItems(res.items);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load + stats
  useEffect(() => {
    load("");
    adminStatsService.fetchSummary().then(setStats);
  }, [load]);

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(val), 350);
  };

  const handleLoadMore = () => load(search, nextCursor ?? undefined);

  const verified  = stats.verifiedUsers;
  const vipCount  = stats.vipUsers;
  const suspended = stats.suspendedUsers;
  const total     = stats.totalUsers;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Users"
        description="Platform user accounts, verification status, and account management."
        actions={
          <button
            onClick={() => load(search)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users",  value: total,     icon: Users,       color: "text-indigo-400" },
          { label: "Verified",     value: verified,  icon: ShieldCheck, color: "text-emerald-400" },
          { label: "VIP",          value: vipCount,  icon: Crown,       color: "text-amber-400" },
          { label: "Suspended",    value: suspended, icon: Ban,         color: "text-red-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                <p className="text-xs text-zinc-500">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by username, email, or referral code…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description={search ? "No users match your search." : "No users registered on this platform yet."} />
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["User", "Status", "Wallet", "Limits", "Referral Code", "Joined", ""].map(h => (
                      <th key={h} className="text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider pb-3 pr-4 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {items.map(u => {
                    const total = u.totalBalance ?? 0;
                    const isSuspended = !!u.suspendedAt;
                    return (
                      <tr
                        key={u.userId}
                        onClick={() => navigate(`/admin/users/${u.userId}`)}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                      >
                        {/* User */}
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-indigo-300">
                                {(u.username || u.email || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white truncate max-w-[140px]">{u.username || "—"}</p>
                                {u.vipStatus && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                                {isSuspended && <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />}
                              </div>
                              <p className="text-[11px] text-zinc-500 truncate max-w-[160px]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="py-3.5 pr-4">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={isSuspended ? "rejected" : u.verificationStatus} label={isSuspended ? "Suspended" : undefined} />
                            {u.phoneVerified && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-500">
                                <Phone className="w-2.5 h-2.5" /> Phone
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Wallet */}
                        <td className="py-3.5 pr-4 hidden sm:table-cell">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white tabular-nums">${total.toFixed(2)}</p>
                            <p className="text-[10px] text-zinc-500">total</p>
                          </div>
                        </td>
                        {/* Limits */}
                        <td className="py-3.5 pr-4 hidden lg:table-cell">
                          <div className="text-xs text-zinc-400">
                            <p>Daily: <span className="text-zinc-300">${(u.dailyWithdrawalUsed ?? 0).toFixed(2)}</span></p>
                            <p>Monthly: <span className="text-zinc-300">${(u.monthlyWithdrawalUsed ?? 0).toFixed(2)}</span></p>
                          </div>
                        </td>
                        {/* Referral */}
                        <td className="py-3.5 pr-4 hidden lg:table-cell">
                          <p className="text-xs text-zinc-400 font-mono">{u.referralCode || "—"}</p>
                        </td>
                        {/* Joined */}
                        <td className="py-3.5 pr-4 hidden md:table-cell">
                          <p className="text-xs text-zinc-500 whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </td>
                        {/* Arrow */}
                        <td className="py-3.5">
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {hasMore && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 border border-white/[0.06] text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-50 transition-all"
                >
                  {loadingMore ? "Loading…" : `Load more (showing ${items.length})`}
                </button>
              </div>
            )}

            <p className="mt-3 text-center text-xs text-zinc-600">
              Showing {items.length} user{items.length !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
