import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDownToLine, Banknote, Bitcoin, CheckCircle2, AlertTriangle, ExternalLink, Clock,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  adminDepositService,
  type AdminDeposit,
} from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const LIMIT = 50;

type StatusFilter = "all" | "pending" | "confirming" | "completed" | "expired";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "pending",    label: "Pending" },
  { value: "confirming", label: "Confirming" },
  { value: "completed",  label: "Completed" },
  { value: "expired",    label: "Expired" },
];

export default function DepositsPage() {
  const navigate = useNavigate();
  const { can }  = useAdminAccess();

  const [items,       setItems]       = useState<AdminDeposit[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [status,      setStatus]      = useState<StatusFilter>("all");
  const [error,       setError]       = useState<string | null>(null);

  const [selected, setSelected] = useState<AdminDeposit | null>(null);
  const [txHash,   setTxHash]   = useState("");
  const [dialog,   setDialog]   = useState(false);
  const [busy,     setBusy]     = useState(false);

  const load = useCallback(async (statusFilter: StatusFilter, cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const res = await adminDepositService.fetchDeposits({
        status: statusFilter !== "all" ? statusFilter : undefined,
        cursor,
        limit: LIMIT,
      });
      if (cursor) setItems(prev => [...prev, ...res.items]);
      else        setItems(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (e: any) {
      setError(e.message ?? "Failed to load deposits");
    } finally {
      if (!cursor) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(status); }, [load, status]);

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s);
    setItems([]);
    setNextCursor(null);
  };

  const openConfirm = (d: AdminDeposit) => {
    setSelected(d);
    setTxHash("");
    setDialog(true);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await adminDepositService.confirmDeposit(selected.id, txHash.trim() || undefined);
      if (result) setItems(prev => prev.map(d => d.id === result.id ? result : d));
    } finally { setBusy(false); setDialog(false); setSelected(null); }
  };

  const pending    = items.filter(d => ["pending","confirming"].includes(d.status)).length;
  const volume     = items.filter(d => d.status === "completed").reduce((s, d) => s + d.requestedAmount, 0);
  const completed  = items.filter(d => d.status === "completed").length;
  const expired    = items.filter(d => d.status === "expired").length;

  const isExpired = (d: AdminDeposit) => d.expiresAt ? new Date(d.expiresAt) < new Date() : false;

  const columns: Column<AdminDeposit>[] = [
    {
      key: "user",
      header: "User",
      render: d => (
        <div>
          <p className="text-sm font-medium text-zinc-200">{d.user?.username || "—"}</p>
          <p className="text-[11px] text-zinc-500">{d.user?.email}</p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: d => (
        <div className="flex items-center gap-2">
          {d.paymentMethod === "bank"
            ? <Banknote className="w-3.5 h-3.5 text-emerald-400" />
            : <Bitcoin className="w-3.5 h-3.5 text-amber-400" />}
          <span className="text-xs text-zinc-300 capitalize">{d.paymentMethod}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: d => (
        <div className="text-right">
          <p className="text-sm font-semibold text-white tabular-nums">${d.requestedAmount.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 font-mono">Memo: {d.memoAmount.toFixed(5)}</p>
        </div>
      ),
      sortable: true, sortValue: d => d.requestedAmount,
    },
    {
      key: "expires",
      header: "Expires",
      render: d => {
        if (d.status === "completed") return <span className="text-xs text-emerald-400">Confirmed</span>;
        if (d.status === "expired" || isExpired(d)) return <span className="text-xs text-red-400">Expired</span>;
        if (!d.expiresAt) return <span className="text-xs text-zinc-600">—</span>;
        const mins = Math.max(0, Math.floor((new Date(d.expiresAt).getTime() - Date.now()) / 60000));
        return (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <Clock className="w-3 h-3" />
            {mins}m left
          </div>
        );
      },
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: d => <StatusBadge status={d.status} />,
      sortable: true, sortValue: d => d.status,
    },
    {
      key: "created",
      header: "Created",
      render: d => (
        <p className="text-xs text-zinc-500 whitespace-nowrap">
          {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </p>
      ),
      sortable: true, sortValue: d => d.createdAt,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: d => (
        <div className="flex items-center gap-1.5 justify-end">
          {can("admin.users.view") && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/admin/users/${d.userId}`); }}
              title="View user"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {["pending","confirming"].includes(d.status) && can("admin.financial.confirm_deposits") && (
            <button
              onClick={e => { e.stopPropagation(); openConfirm(d); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 text-[11px] font-medium transition-all"
            >
              <CheckCircle2 className="w-3 h-3" /> Confirm
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Deposits"
        description="Monitor incoming deposits and confirm or expire pending requests."
        badge={pending > 0 ? { label: `${pending} pending`, variant: "warning" } : undefined}
      />

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Awaiting Confirmation", value: pending,   color: "text-amber-400" },
          { label: "Volume Confirmed",       value: `$${volume.toFixed(0)}`, color: "text-emerald-400" },
          { label: "Completed",              value: completed, color: "text-zinc-200" },
          { label: "Expired",                value: expired,   color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
            <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleStatusChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              status === f.value
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
          keyExtractor={d => d.id}
          loading={loading}
          emptyIcon={ArrowDownToLine}
          emptyTitle="No deposits found"
          emptyDescription={status !== "all" ? `No ${status} deposits.` : "Deposit requests will appear here once submitted by users."}
          pageSize={LIMIT}
        />

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => load(status, nextCursor!)}
              disabled={loadingMore}
              className="px-6 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50 transition-all"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>

      {/* Confirm dialog with optional txHash */}
      {dialog && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(false)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Confirm Deposit</h3>
                <p className="text-sm text-zinc-400">
                  Credit ${selected.requestedAmount.toFixed(2)} to {selected.user?.username || "user"}'s main wallet.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">TX Hash (optional)</label>
              <input
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
                placeholder="Blockchain transaction hash or reference"
                className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDialog(false)} className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-all">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm Deposit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
