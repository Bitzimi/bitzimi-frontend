import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowUpFromLine, Banknote, Bitcoin, XCircle, AlertTriangle, ExternalLink,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  adminWithdrawalService,
  type AdminWithdrawal,
} from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const LIMIT = 50;

type StatusFilter = "all" | "submitted" | "processing" | "completed" | "rejected";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "submitted",  label: "Submitted" },
  { value: "processing", label: "Processing" },
  { value: "completed",  label: "Completed" },
  { value: "rejected",   label: "Rejected" },
];

type DialogType = "process" | "complete" | "reject" | null;

export default function WithdrawalsPage() {
  const navigate = useNavigate();
  const { can }  = useAdminAccess();

  const [items,      setItems]      = useState<AdminWithdrawal[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore,    setHasMore]    = useState(false);
  const [status,     setStatus]     = useState<StatusFilter>("all");
  const [error,      setError]      = useState<string | null>(null);

  const [dialog,    setDialog]    = useState<DialogType>(null);
  const [selected,  setSelected]  = useState<AdminWithdrawal | null>(null);
  const [txHash,    setTxHash]    = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy,      setBusy]      = useState(false);

  const load = useCallback(async (statusFilter: StatusFilter, cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const res = await adminWithdrawalService.fetchWithdrawals({
        status: statusFilter !== "all" ? statusFilter : undefined,
        cursor,
        limit: LIMIT,
      });
      if (cursor) setItems(prev => [...prev, ...res.items]);
      else        setItems(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (e: any) {
      setError(e.message ?? "Failed to load withdrawals");
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

  const openDialog = (w: AdminWithdrawal, type: DialogType) => {
    setSelected(w);
    setDialog(type);
    setTxHash("");
    setRejectReason("");
  };

  const handleProcess = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await adminWithdrawalService.processWithdrawal(selected.id);
      if (result) setItems(prev => prev.map(w => w.id === result.id ? result : w));
    } finally { setBusy(false); setDialog(null); setSelected(null); }
  };

  const handleComplete = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await adminWithdrawalService.completeWithdrawal(selected.id, txHash.trim() || undefined);
      if (result) setItems(prev => prev.map(w => w.id === result.id ? result : w));
    } finally { setBusy(false); setDialog(null); setSelected(null); }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setBusy(true);
    try {
      const result = await adminWithdrawalService.rejectWithdrawal(selected.id, rejectReason.trim());
      if (result) setItems(prev => prev.map(w => w.id === result.id ? result : w));
    } finally { setBusy(false); setDialog(null); setSelected(null); }
  };

  const pending    = items.filter(w => w.status === "submitted").length;
  const processing = items.filter(w => w.status === "processing").length;
  const volume     = items.filter(w => !["rejected"].includes(w.status)).reduce((s, w) => s + w.amount, 0);
  const completed  = items.filter(w => w.status === "completed").length;

  const columns: Column<AdminWithdrawal>[] = [
    {
      key: "user",
      header: "User",
      render: w => (
        <div>
          <p className="text-sm font-medium text-zinc-200">{w.user?.username || "—"}</p>
          <p className="text-[11px] text-zinc-500">{w.user?.email}</p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: w => (
        <div className="flex items-center gap-2">
          {w.paymentMethod === "bank"
            ? <Banknote className="w-3.5 h-3.5 text-emerald-400" />
            : <Bitcoin className="w-3.5 h-3.5 text-amber-400" />}
          <span className="text-xs text-zinc-300 capitalize">{w.paymentMethod}</span>
        </div>
      ),
      sortable: true, sortValue: w => w.paymentMethod,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: w => (
        <div className="text-right">
          <p className="text-sm font-semibold text-white tabular-nums">${w.amount.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500">Net: ${w.netAmount.toFixed(2)}</p>
        </div>
      ),
      sortable: true, sortValue: w => w.amount,
    },
    {
      key: "destination",
      header: "Destination",
      render: w => (
        <p className="text-xs text-zinc-400 font-mono max-w-[130px] truncate" title={w.destination}>{w.destination}</p>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: w => <StatusBadge status={w.status} />,
      sortable: true, sortValue: w => w.status,
    },
    {
      key: "submitted",
      header: "Submitted",
      render: w => (
        <p className="text-xs text-zinc-500 whitespace-nowrap">
          {new Date(w.submittedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </p>
      ),
      sortable: true, sortValue: w => w.submittedAt,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: w => (
        <div className="flex items-center gap-1.5 justify-end">
          {can("admin.users.view") && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/admin/users/${w.userId}`); }}
              title="View user"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {w.status === "submitted" && can("admin.financial.process_withdrawals") && (
            <button
              onClick={e => { e.stopPropagation(); openDialog(w, "process"); }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-600/25 text-[11px] font-medium transition-all"
            >
              Process
            </button>
          )}
          {w.status === "processing" && can("admin.financial.process_withdrawals") && (
            <button
              onClick={e => { e.stopPropagation(); openDialog(w, "complete"); }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 text-[11px] font-medium transition-all"
            >
              Complete
            </button>
          )}
          {["submitted","processing"].includes(w.status) && can("admin.financial.process_withdrawals") && (
            <button
              onClick={e => { e.stopPropagation(); openDialog(w, "reject"); }}
              className="p-1.5 rounded-lg text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Reject"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Withdrawals"
        description="Review and process withdrawal requests from bank and crypto methods."
        badge={pending > 0 ? { label: `${pending} need action`, variant: "warning" } : undefined}
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
          { label: "Pending Action", value: pending,    color: "text-amber-400" },
          { label: "Processing",     value: processing, color: "text-indigo-400" },
          { label: "Volume Shown",   value: `$${volume.toFixed(0)}`, color: "text-white" },
          { label: "Completed",      value: completed,  color: "text-emerald-400" },
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
          keyExtractor={w => w.id}
          loading={loading}
          emptyIcon={ArrowUpFromLine}
          emptyTitle="No withdrawals found"
          emptyDescription={status !== "all" ? `No ${status} withdrawals.` : "Withdrawal requests will appear here once submitted."}
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

      {/* Process dialog */}
      <ConfirmDialog
        open={dialog === "process"}
        variant="info"
        title="Mark as Processing?"
        message={`Move withdrawal of $${selected?.amount.toFixed(2)} to Processing status. The user will be notified.`}
        confirmLabel={busy ? "Processing…" : "Mark Processing"}
        onConfirm={handleProcess}
        onCancel={() => setDialog(null)}
      />

      {/* Complete dialog (with optional txHash) */}
      {dialog === "complete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-1">Complete Withdrawal</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Mark ${selected.amount.toFixed(2)} withdrawal as completed. Optionally provide a transaction hash.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">TX Hash (optional)</label>
              <input
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
                placeholder="0x… or blockchain reference"
                className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDialog(null)} className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-all">
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={busy}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {busy ? "Completing…" : "Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {dialog === "reject" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Reject Withdrawal</h3>
                <p className="text-sm text-zinc-400">The amount will be refunded to the user's main wallet.</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Invalid destination address, compliance hold…"
                className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDialog(null)} className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-all">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={busy || !rejectReason.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {busy ? "Rejecting…" : "Reject & Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
