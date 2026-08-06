import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet, Search, RefreshCw, AlertTriangle, CheckCircle,
  ArrowDownLeft, ArrowUpRight,
  Snowflake, Flame, BarChart3, ClipboardList, Activity, Shield,
  Loader2, Info, Eye,
} from "lucide-react";
import {
  adminWalletService,
  type AdminWalletStats,
  type AdminWalletUserRow,
  type AdminWalletDetail,
  type AdminWalletLedgerEntry,
  type AdminWalletAuditEntry,
  type AdminWalletDiagnostics,
  type WalletType,
} from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

// ── Constants ─────────────────────────────────────────────────────────────────

const WALLET_TYPES: WalletType[] = [
  "main", "game", "task", "referral", "affiliate", "task_vault", "ambassador",
];

const WALLET_LABELS: Record<string, string> = {
  main: "Main", game: "Game", task: "Task", referral: "Referral",
  affiliate: "Affiliate", task_vault: "Task Vault", ambassador: "Ambassador",
};

const WALLET_COLORS: Record<string, string> = {
  main: "text-blue-400", game: "text-purple-400", task: "text-yellow-400",
  referral: "text-green-400", affiliate: "text-orange-400",
  task_vault: "text-cyan-400", ambassador: "text-pink-400",
};

const TX_TYPE_LABELS: Record<string, string> = {
  admin_credit: "Admin Credit", admin_debit: "Admin Debit",
  wallet_freeze: "Freeze", wallet_unfreeze: "Unfreeze",
  transfer: "Transfer", deposit: "Deposit", withdrawal: "Withdrawal",
  game_win: "Game Win", game_loss: "Game Loss", referral_bonus: "Referral Bonus",
  task_reward: "Task Reward", commission: "Commission",
};

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

// ── Shared UI Primitives ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "text-white" }: {
  label: string; value: string | number; sub?: string; icon: React.FC<any>; color?: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 flex gap-4 items-start">
      <div className="p-2 rounded-lg bg-white/5 mt-0.5">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: "red" | "yellow" | "green" | "blue" | "gray" }) {
  const cls = {
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    green: "bg-green-500/20 text-green-300 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    gray: "bg-white/10 text-white/60 border-white/10",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin text-white/40" />;
}

function EmptyRow({ msg }: { msg: string }) {
  return (
    <tr>
      <td colSpan={99} className="py-12 text-center text-white/30 text-sm">{msg}</td>
    </tr>
  );
}

function Input({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 ${className}`}
    />
  );
}

function Select({ value, onChange, options, className = "" }: {
  value: string; onChange: (v: string) => void;
  options: { label: string; value: string }[]; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
      ))}
    </select>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel, loading, confirmLabel = "Confirm", danger = false }: {
  title: string; message: React.ReactNode; onConfirm: () => void; onCancel: () => void;
  loading?: boolean; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <div className="text-sm text-white/60 mb-6">{message}</div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credit / Debit Dialog ─────────────────────────────────────────────────────

function CreditDebitDialog({ mode, userId, userEmail, onClose, onSuccess }: {
  mode: "credit" | "debit"; userId: string; userEmail: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [walletType, setWalletType] = useState<WalletType>("main");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCredit = mode === "credit";

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      if (isCredit) {
        await adminWalletService.credit(userId, { walletType, amount: parseFloat(amount), reason });
      } else {
        await adminWalletService.debit(userId, { walletType, amount: parseFloat(amount), reason });
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? "Action failed");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className={`text-lg font-bold mb-4 ${isCredit ? "text-green-400" : "text-red-400"}`}>
          {isCredit ? "Manual Credit" : "Manual Debit"}
        </h3>
        <p className="text-xs text-white/40 mb-4">User: {userEmail}</p>

        {step === "form" ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Wallet</label>
                <Select
                  value={walletType}
                  onChange={(v) => setWalletType(v as WalletType)}
                  options={WALLET_TYPES.map((t) => ({ value: t, label: WALLET_LABELS[t] }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Amount (USD)</label>
                <Input value={amount} onChange={setAmount} placeholder="0.00" className="w-full" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Reason (required, min 5 chars)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Describe the reason for this action..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>
            </div>
            {error && <p className="mt-3 text-red-400 text-xs">{error}</p>}
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError("Enter a valid amount"); return; }
                  if (reason.length < 5) { setError("Reason must be at least 5 characters"); return; }
                  setError(null);
                  setStep("confirm");
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${isCredit ? "bg-green-700 hover:bg-green-600" : "bg-red-700 hover:bg-red-600"}`}
              >
                Review
              </button>
            </div>
          </>
        ) : (
          <div>
            <p className="text-white/60 text-sm mb-4">
              {isCredit ? "Credit" : "Debit"}{" "}
              <span className="text-white font-bold">{fmtUSD(parseFloat(amount))}</span>{" "}
              {isCredit ? "to" : "from"}{" "}
              <span className="text-white">{WALLET_LABELS[walletType]} Wallet</span>
              <br />
              <span className="text-white/40 text-xs mt-1 block">Reason: {reason}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep("form")} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5">Back</button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 ${isCredit ? "bg-green-700 hover:bg-green-600" : "bg-red-700 hover:bg-red-600"}`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm {isCredit ? "Credit" : "Debit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Freeze Dialog ─────────────────────────────────────────────────────────────

function FreezeDialog({ userId, userEmail, wallet, onClose, onSuccess }: {
  userId: string; userEmail: string; wallet: AdminWalletDetail;
  onClose: () => void; onSuccess: () => void;
}) {
  const isFreezing = !wallet.isFrozen;
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (isFreezing && reason.length < 5) { setError("Reason must be at least 5 characters"); return; }
    setLoading(true);
    setError(null);
    try {
      if (isFreezing) {
        await adminWalletService.freeze(userId, { walletType: wallet.walletType as WalletType, reason });
      } else {
        await adminWalletService.unfreeze(userId, { walletType: wallet.walletType as WalletType });
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className={`text-lg font-bold mb-2 ${isFreezing ? "text-blue-400" : "text-green-400"}`}>
          {isFreezing ? "Freeze Wallet" : "Unfreeze Wallet"}
        </h3>
        <p className="text-xs text-white/40 mb-4">{userEmail} — {WALLET_LABELS[wallet.walletType]} Wallet</p>
        {isFreezing ? (
          <div className="mb-4">
            <label className="block text-xs text-white/40 mb-1.5">Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason for freezing this wallet..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
            />
          </div>
        ) : (
          <p className="text-white/60 text-sm mb-4">
            This wallet was frozen by <span className="text-white">{wallet.frozenBy ?? "unknown"}</span> on {fmtDate(wallet.frozenAt)}.
            <br />Reason: <span className="text-white/80 italic">{wallet.frozenReason ?? "not specified"}</span>
          </p>
        )}
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5">Cancel</button>
          <button
            onClick={handle}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50 ${isFreezing ? "bg-blue-700 hover:bg-blue-600" : "bg-green-700 hover:bg-green-600"}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isFreezing ? "Freeze" : "Unfreeze"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Wallet Drawer ────────────────────────────────────────────────────────

function UserWalletDrawer({ userId, userEmail, onClose, canManage }: {
  userId: string; userEmail: string; onClose: () => void; canManage: boolean;
}) {
  const [data, setData] = useState<{ userId: string; email: string; username: string | null; fullName: string | null; wallets: AdminWalletDetail[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { type: "credit" | "debit" | "freeze"; wallet: AdminWalletDetail }>(null);
  const [ledger, setLedger] = useState<AdminWalletLedgerEntry[]>([]);
  const [ledgerWallet, setLedgerWallet] = useState("");
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await adminWalletService.getUserWallets(userId);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await adminWalletService.getUserLedger(userId, {
        walletType: ledgerWallet || undefined,
        limit: 20,
      });
      setLedger(res.entries);
    } catch {}
    setLedgerLoading(false);
  }, [userId, ledgerWallet]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLedger(); }, [loadLedger]);

  function onActionSuccess() {
    setDialog(null);
    load();
    loadLedger();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-zinc-950 border-l border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{data?.username ?? userEmail}</h2>
            <p className="text-xs text-white/40">{userEmail}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">✕</button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="p-5 text-red-400 text-sm">{error}</div>
        )}

        {data && !loading && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Wallet cards */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Wallets</h3>
              <div className="space-y-2">
                {data.wallets.map((w) => (
                  <div
                    key={w.walletType}
                    className={`rounded-xl border p-4 ${w.isFrozen ? "border-blue-500/30 bg-blue-500/5" : "border-white/8 bg-white/3"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${WALLET_COLORS[w.walletType]}`}>
                          {WALLET_LABELS[w.walletType]}
                        </span>
                        {w.isFrozen && (
                          <Badge color="blue">
                            <Snowflake className="w-3 h-3" /> Frozen
                          </Badge>
                        )}
                      </div>
                      <span className="text-white font-bold">{fmtUSD(w.balance)}</span>
                    </div>

                    {w.isFrozen && (
                      <p className="text-xs text-blue-300/60 mt-2">
                        Frozen: {fmtDate(w.frozenAt)} — {w.frozenReason ?? "no reason"}
                      </p>
                    )}

                    {canManage && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setDialog({ type: "credit", wallet: w })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/20 transition-colors"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Credit
                        </button>
                        <button
                          onClick={() => setDialog({ type: "debit", wallet: w })}
                          disabled={w.isFrozen}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 transition-colors disabled:opacity-30"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> Debit
                        </button>
                        <button
                          onClick={() => setDialog({ type: "freeze", wallet: w })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${w.isFrozen ? "bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-500/20" : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/20"}`}
                        >
                          {w.isFrozen ? <><Flame className="w-3.5 h-3.5" /> Unfreeze</> : <><Snowflake className="w-3.5 h-3.5" /> Freeze</>}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ledger */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Recent Transactions</h3>
                <Select
                  value={ledgerWallet}
                  onChange={setLedgerWallet}
                  options={[{ value: "", label: "All wallets" }, ...WALLET_TYPES.map((t) => ({ value: t, label: WALLET_LABELS[t] }))]}
                  className="text-xs py-1"
                />
                {ledgerLoading && <Spinner />}
              </div>
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-xs text-white/30">
                      <th className="text-left px-3 py-2.5">Type</th>
                      <th className="text-left px-3 py-2.5">Wallet</th>
                      <th className="text-right px-3 py-2.5">Amount</th>
                      <th className="text-left px-3 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <EmptyRow msg="No transactions" />
                    ) : ledger.map((e) => (
                      <tr key={e.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="text-white/70 text-xs">{TX_TYPE_LABELS[e.type] ?? e.type}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-white/40">{e.toWallet ?? e.fromWallet ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={e.toWallet && !e.fromWallet ? "text-green-400 text-xs font-medium" : "text-red-400 text-xs font-medium"}>
                            {e.toWallet && !e.fromWallet ? "+" : "-"}{fmtUSD(e.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-white/30">{fmtDate(e.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-dialogs */}
      {dialog?.type === "credit" && (
        <CreditDebitDialog mode="credit" userId={userId} userEmail={userEmail} onClose={() => setDialog(null)} onSuccess={onActionSuccess} />
      )}
      {dialog?.type === "debit" && (
        <CreditDebitDialog mode="debit" userId={userId} userEmail={userEmail} onClose={() => setDialog(null)} onSuccess={onActionSuccess} />
      )}
      {dialog?.type === "freeze" && dialog.wallet && (
        <FreezeDialog userId={userId} userEmail={userEmail} wallet={dialog.wallet} onClose={() => setDialog(null)} onSuccess={onActionSuccess} />
      )}
    </div>
  );
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<AdminWalletStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await adminWalletService.getStats());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  if (error)   return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!stats)  return null;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Platform Balance" value={fmtUSD(stats.grandTotalBalance)} icon={Wallet} color="text-blue-400" />
        <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} icon={BarChart3} color="text-purple-400" />
        <StatCard label="Active Wallets" value={stats.totalActiveWallets.toLocaleString()} sub="wallets with balance > 0" icon={CheckCircle} color="text-green-400" />
        <StatCard label="Frozen Wallets" value={stats.totalFrozenWallets.toLocaleString()} icon={Snowflake} color="text-blue-300" />
      </div>

      {/* By type */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 mb-3">Balance by Wallet Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {WALLET_TYPES.map((t) => {
            const info = stats.byType[t] ?? { totalBalance: 0, walletCount: 0, frozenCount: 0 };
            return (
              <div key={t} className="bg-white/3 border border-white/8 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${WALLET_COLORS[t]}`}>{WALLET_LABELS[t]}</span>
                  {info.frozenCount > 0 && (
                    <Badge color="blue"><Snowflake className="w-3 h-3" />{info.frozenCount}</Badge>
                  )}
                </div>
                <p className="text-xl font-bold text-white">{fmtUSD(info.totalBalance)}</p>
                <p className="text-xs text-white/30 mt-1">{info.walletCount} wallets</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Explorer ─────────────────────────────────────────────────────────────

function ExplorerTab({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminWalletUserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; email: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminWalletService.searchUsers({ search: q || undefined, cursor, limit: 25 });
      setUsers(cursor ? (prev) => [...prev, ...res.users] : res.users);
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input value={search} onChange={setSearch} placeholder="Search by email or username..." className="pl-9 w-full" />
        </div>
        <button onClick={() => load(search)} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
        {loading && <Spinner />}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/3 text-xs text-white/30">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-right px-4 py-3">Total Balance</th>
              {WALLET_TYPES.slice(0, 4).map((t) => (
                <th key={t} className={`text-right px-4 py-3 hidden lg:table-cell ${WALLET_COLORS[t]}`}>{WALLET_LABELS[t]}</th>
              ))}
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading ? (
              <EmptyRow msg="No users found" />
            ) : users.map((u) => (
              <tr key={u.userId} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white text-sm">{u.username ?? u.email}</div>
                  <div className="text-xs text-white/30">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-right font-bold text-white">{fmtUSD(u.totalBalance)}</td>
                {WALLET_TYPES.slice(0, 4).map((t) => (
                  <td key={t} className={`px-4 py-3 text-right text-xs hidden lg:table-cell ${WALLET_COLORS[t]}`}>
                    {fmtUSD(u.balances[t] ?? 0)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  {u.hasFrozenWallet && <Badge color="blue"><Snowflake className="w-3 h-3" /> Frozen</Badge>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedUser({ userId: u.userId, email: u.email })}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          onClick={() => load(search, nextCursor)}
          disabled={loading}
          className="w-full py-2.5 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          Load more
        </button>
      )}

      {selectedUser && (
        <UserWalletDrawer
          userId={selectedUser.userId}
          userEmail={selectedUser.email}
          canManage={canManage}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

// ── Tab: Ledger ───────────────────────────────────────────────────────────────

function LedgerTab() {
  const [entries, setEntries] = useState<AdminWalletLedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletFilter, setWalletFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const res = await adminWalletService.getLedger({
        walletType: walletFilter || undefined,
        type: typeFilter || undefined,
        cursor,
        limit: 50,
      });
      setEntries(cursor ? (prev) => [...prev, ...res.entries] : res.entries);
      setNextCursor(res.nextCursor);
    } catch {}
    setLoading(false);
  }, [walletFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={walletFilter}
          onChange={(v) => { setWalletFilter(v); setEntries([]); }}
          options={[{ value: "", label: "All wallet types" }, ...WALLET_TYPES.map((t) => ({ value: t, label: WALLET_LABELS[t] }))]}
        />
        <Select
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); setEntries([]); }}
          options={[
            { value: "", label: "All transaction types" },
            { value: "admin_credit", label: "Admin Credit" },
            { value: "admin_debit", label: "Admin Debit" },
            { value: "wallet_freeze", label: "Freeze" },
            { value: "wallet_unfreeze", label: "Unfreeze" },
            { value: "deposit", label: "Deposit" },
            { value: "withdrawal", label: "Withdrawal" },
            { value: "game_win", label: "Game Win" },
            { value: "game_loss", label: "Game Loss" },
            { value: "transfer", label: "Transfer" },
          ]}
        />
        {loading && <Spinner />}
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/3 text-xs text-white/30">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Wallet</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3">Net</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading ? (
              <EmptyRow msg="No transactions found" />
            ) : entries.map((e) => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-xs text-white/60">{e.username ?? e.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge color={e.type === "admin_credit" ? "green" : e.type === "admin_debit" ? "red" : e.type.includes("freeze") ? "blue" : "gray"}>
                    {TX_TYPE_LABELS[e.type] ?? e.type}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${WALLET_COLORS[e.toWallet ?? e.fromWallet ?? ""] ?? "text-white/40"}`}>
                    {e.toWallet ?? e.fromWallet ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white text-xs font-medium">{fmtUSD(e.amount)}</td>
                <td className="px-4 py-3 text-right text-white/60 text-xs">{fmtUSD(e.netAmount)}</td>
                <td className="px-4 py-3 text-xs text-white/30">{fmtDate(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          onClick={() => load(nextCursor)}
          disabled={loading}
          className="w-full py-2.5 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  );
}

// ── Tab: Diagnostics ──────────────────────────────────────────────────────────

function DiagnosticsTab() {
  const [data, setData] = useState<AdminWalletDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setData(await adminWalletService.getDiagnostics());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Run Diagnostics
        </button>
        {data && <p className="text-xs text-white/30">Last checked: {fmtDate(data.checkedAt)}</p>}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!data && !loading && (
        <div className="text-center py-16 text-white/20 text-sm">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Click "Run Diagnostics" to check wallet health
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Issues" value={data.totalIssues} icon={AlertTriangle} color={data.totalIssues > 0 ? "text-yellow-400" : "text-white/40"} />
            <StatCard label="Critical" value={data.criticalCount} icon={AlertTriangle} color={data.criticalCount > 0 ? "text-red-400" : "text-white/40"} />
            <StatCard label="Warnings" value={data.warningCount} icon={Info} color={data.warningCount > 0 ? "text-yellow-400" : "text-white/40"} />
          </div>

          {data.issues.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm text-green-300">No wallet issues detected. All balances are healthy.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.issues.map((issue, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border ${issue.severity === "critical" ? "bg-red-500/10 border-red-500/20" : "bg-yellow-500/10 border-yellow-500/20"}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${issue.severity === "critical" ? "text-red-400" : "text-yellow-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge color={issue.severity === "critical" ? "red" : "yellow"}>{issue.severity}</Badge>
                        <span className="text-xs text-white/40 font-mono">{issue.type}</span>
                      </div>
                      <p className="text-sm text-white/70">{issue.detail}</p>
                      <p className="text-xs text-white/30 mt-1">User: {issue.userId} · Wallet: {issue.walletType} · Balance: {fmtUSD(issue.balance)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Audit Log ────────────────────────────────────────────────────────────

function AuditTab() {
  const [entries, setEntries] = useState<AdminWalletAuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminWalletService.getAuditLog({ cursor, limit: 50 });
      setEntries(cursor ? (prev) => [...prev, ...res.entries] : res.entries);
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ACTION_COLORS: Record<string, string> = {
    admin_credit: "green", admin_debit: "red",
    wallet_freeze: "blue", wallet_unfreeze: "green",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">All admin wallet actions — credit, debit, freeze, unfreeze</p>
        <button onClick={() => load()} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/3 text-xs text-white/30">
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Wallet</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3">Before</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading ? (
              <EmptyRow msg="No admin wallet actions recorded yet" />
            ) : entries.map((e) => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <Badge color={(ACTION_COLORS[e.type] as any) ?? "gray"}>
                    {TX_TYPE_LABELS[e.type] ?? e.type}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-white/60">{e.username ?? e.userEmail}</div>
                  <div className="text-xs text-white/30">{e.userEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${WALLET_COLORS[e.walletType] ?? "text-white/40"}`}>
                    {WALLET_LABELS[e.walletType] ?? e.walletType}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-white">{fmtUSD(e.amount)}</td>
                <td className="px-4 py-3 text-right text-xs text-white/40">{e.balanceBefore !== null ? fmtUSD(e.balanceBefore) : "—"}</td>
                <td className="px-4 py-3 max-w-[200px]">
                  <span className="text-xs text-white/50 truncate block">{e.reason ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-xs text-white/30">{fmtDate(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          onClick={() => load(nextCursor)}
          disabled={loading}
          className="w-full py-2.5 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "explorer" | "ledger" | "diagnostics" | "audit";

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: BarChart3 },
  { id: "explorer",    label: "User Explorer", icon: Search },
  { id: "ledger",      label: "Ledger",       icon: ClipboardList },
  { id: "diagnostics", label: "Diagnostics",  icon: Activity },
  { id: "audit",       label: "Audit Log",    icon: Shield },
];

export default function WalletManagementPage() {
  const { can } = useAdminAccess();
  const canView   = can("admin.wallets.view");
  const canManage = can("admin.wallets.manage");
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/30">
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm mt-1">You do not have permission to view wallet management.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Page header */}
      <div className="px-6 pt-8 pb-6 border-b border-white/8">
        <div className="flex items-center gap-3 mb-1">
          <Wallet className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold">Wallet Management</h1>
        </div>
        <p className="text-sm text-white/40">
          Platform wallet overview, user balances, ledger history, and admin actions.
          {!canManage && <span className="ml-2 text-yellow-500/60">(View-only)</span>}
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-white/8">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? "border-blue-500 text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {tab === "dashboard"   && <DashboardTab />}
        {tab === "explorer"    && <ExplorerTab canManage={canManage} />}
        {tab === "ledger"      && <LedgerTab />}
        {tab === "diagnostics" && <DiagnosticsTab />}
        {tab === "audit"       && <AuditTab />}
      </div>
    </div>
  );
}
