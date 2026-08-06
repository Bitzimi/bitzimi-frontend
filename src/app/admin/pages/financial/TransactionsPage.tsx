import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ListOrdered, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft,
  Gamepad2, CheckCircle2, Gift, AlertTriangle, ExternalLink,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { DataTable, type Column } from "../../components/ui/DataTable";
import {
  adminTransactionService,
  type AdminTransaction,
} from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const LIMIT = 50;

const TYPE_ICONS: Record<string, React.ElementType> = {
  deposit:        ArrowDownToLine,
  withdrawal:     ArrowUpFromLine,
  transfer:       ArrowRightLeft,
  game_win:       Gamepad2,
  game_loss:      Gamepad2,
  task_reward:    CheckCircle2,
  referral_bonus: Gift,
};

const TYPE_COLORS: Record<string, string> = {
  deposit:        "text-emerald-400",
  withdrawal:     "text-red-400",
  transfer:       "text-indigo-400",
  game_win:       "text-emerald-400",
  game_loss:      "text-red-400",
  task_reward:    "text-amber-400",
  referral_bonus: "text-purple-400",
};

const TYPE_LABELS: Record<string, string> = {
  deposit:        "Deposit",
  withdrawal:     "Withdrawal",
  transfer:       "Transfer",
  game_win:       "Game Win",
  game_loss:      "Game Loss",
  task_reward:    "Task Reward",
  referral_bonus: "Referral Bonus",
};

const CREDIT_TYPES = new Set(["deposit", "game_win", "task_reward", "referral_bonus"]);

type TypeFilter = "all" | string;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all",            label: "All" },
  { value: "deposit",        label: "Deposits" },
  { value: "withdrawal",     label: "Withdrawals" },
  { value: "game_win",       label: "Game Wins" },
  { value: "game_loss",      label: "Game Losses" },
  { value: "task_reward",    label: "Task Rewards" },
  { value: "referral_bonus", label: "Referral Bonuses" },
  { value: "transfer",       label: "Transfers" },
];

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { can }  = useAdminAccess();

  const [items,       setItems]       = useState<AdminTransaction[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [typeFilter,  setTypeFilter]  = useState<TypeFilter>("all");
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async (type: TypeFilter, cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const res = await adminTransactionService.fetchTransactions({
        type: type !== "all" ? type : undefined,
        cursor,
        limit: LIMIT,
      });
      if (cursor) setItems(prev => [...prev, ...res.items]);
      else        setItems(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (e: any) {
      setError(e.message ?? "Failed to load transactions");
    } finally {
      if (!cursor) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(typeFilter); }, [load, typeFilter]);

  const handleTypeChange = (t: TypeFilter) => {
    setTypeFilter(t);
    setItems([]);
    setNextCursor(null);
  };

  const totalVolume   = items.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalDeposits = items.filter(t => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const totalWithdraw = items.filter(t => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);

  const columns: Column<AdminTransaction>[] = [
    {
      key: "type",
      header: "Type",
      render: t => {
        const Icon  = TYPE_ICONS[t.type] ?? ListOrdered;
        const color = TYPE_COLORS[t.type] ?? "text-zinc-400";
        return (
          <div className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
            <span className="text-sm text-zinc-300 whitespace-nowrap">{TYPE_LABELS[t.type] ?? t.type}</span>
          </div>
        );
      },
      sortable: true, sortValue: t => t.type,
    },
    {
      key: "user",
      header: "User",
      render: t => (
        <div>
          <p className="text-sm text-zinc-300">{t.user?.username || "—"}</p>
          <p className="text-[11px] text-zinc-500">{t.user?.email}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: t => {
        const isCredit = CREDIT_TYPES.has(t.type);
        return (
          <div className="text-right">
            <p className={`text-sm font-semibold tabular-nums ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
              {isCredit ? "+" : "−"}${Math.abs(t.amount).toFixed(2)}
            </p>
            {t.fee > 0 && <p className="text-[11px] text-zinc-600">Fee: ${t.fee.toFixed(2)}</p>}
          </div>
        );
      },
      sortable: true, sortValue: t => t.amount,
    },
    {
      key: "wallets",
      header: "Wallets",
      render: t => (
        <p className="text-[11px] text-zinc-500 font-mono">
          {[t.fromWallet, t.toWallet].filter(Boolean).join(" → ") || "—"}
        </p>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: t => <StatusBadge status={t.status} />,
      sortable: true, sortValue: t => t.status,
    },
    {
      key: "description",
      header: "Description",
      render: t => (
        <p className="text-xs text-zinc-400 max-w-[180px] truncate" title={t.description ?? ""}>{t.description || "—"}</p>
      ),
      hideOnMobile: true,
    },
    {
      key: "date",
      header: "Date",
      render: t => (
        <p className="text-xs text-zinc-500 whitespace-nowrap">
          {new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </p>
      ),
      sortable: true, sortValue: t => t.createdAt,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: t => (
        can("admin.users.view") ? (
          <button
            onClick={e => { e.stopPropagation(); navigate(`/admin/users/${t.userId}`); }}
            title="View user"
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        ) : null
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Transactions"
        description="Full platform transaction ledger — all users, all types."
      />

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Transactions Shown", value: items.length },
          { label: "Volume Shown",        value: `$${totalVolume.toFixed(2)}`, color: "text-white" },
          { label: "Deposits",            value: `$${totalDeposits.toFixed(2)}`, color: "text-emerald-400" },
          { label: "Withdrawals",         value: `$${totalWithdraw.toFixed(2)}`, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
            <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold tabular-nums ${s.color ?? "text-zinc-200"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleTypeChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              typeFilter === f.value
                ? "bg-indigo-600 text-white"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
        <DataTable
          data={items}
          columns={columns}
          keyExtractor={t => t.id}
          loading={loading}
          emptyIcon={ListOrdered}
          emptyTitle="No transactions found"
          emptyDescription={typeFilter !== "all" ? `No ${TYPE_LABELS[typeFilter] ?? typeFilter} transactions.` : "Transactions will appear here as users interact with the platform."}
          pageSize={LIMIT}
        />

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => load(typeFilter, nextCursor!)}
              disabled={loadingMore}
              className="px-6 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50 transition-all"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
