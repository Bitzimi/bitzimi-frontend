import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Copy, CheckCircle2, Clock, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { depositMonitoringService } from "../services/depositMonitoringService";

// Wallet address is NEVER hardcoded here.
// It is served exclusively by the backend inside the deposit session record (deposit.paymentAddress).
const _CD_API = (import.meta as any).env?.VITE_API_URL as string | undefined;
function _cdToken() { return localStorage.getItem("bitzimi_access_token"); }

interface BackendDeposit {
  id: string;
  requestedAmount: number;
  memoAmount: number;
  paymentMethod: string;
  paymentAddress: string;
  status: "pending" | "confirming" | "completed" | "expired";
  expiresAt: string;
}

interface CryptoDepositDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  formatCurrency: (amount: number) => string;
  onDepositInitiated: (depositId: string, amount: number, uniqueAmount: number) => void;
  onDepositConfirmed?: () => void; // refreshes wallets when backend confirms
}


function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CryptoDepositDialog({
  open, onClose, userId, formatCurrency, onDepositInitiated, onDepositConfirmed,
}: CryptoDepositDialogProps) {
  const [step, setStep] = useState<"enter" | "monitor">("enter");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState<BackendDeposit | null>(null);
  const [minDeposit, setMinDeposit] = useState(5); // backend default; overridden by /api/v1/deposits/crypto-info
  const [copied, setCopied] = useState<"address" | "memo" | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [creating, setCreating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollStatus = useCallback(async (depositId: string) => {
    if (!_CD_API || !_cdToken()) return;
    try {
      const res = await fetch(`${_CD_API}/api/v1/deposits/${depositId}`, {
        headers: { Authorization: `Bearer ${_cdToken()}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const d: BackendDeposit = json.data;
      setDeposit(d);
      if (d.status === "completed") {
        stopPolling();
        onDepositConfirmed?.();
      } else if (d.status === "expired") {
        stopPolling();
      }
    } catch {}
  }, [onDepositConfirmed]);

  // On open: fetch minimum deposit config from backend, then restore active deposit
  useEffect(() => {
    if (!open) return;
    if (_CD_API && _cdToken()) {
      fetch(`${_CD_API}/api/v1/deposits/crypto-info`, {
        headers: { Authorization: `Bearer ${_cdToken()}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(json => { if (json?.data?.minimumDeposit) setMinDeposit(json.data.minimumDeposit); })
        .catch(() => {});
    }
  }, [open]);

  // On open: restore active backend deposit, then fall back to local monitoring
  useEffect(() => {
    if (!open) return;

    const restore = async () => {
      if (_CD_API && _cdToken()) {
        try {
          const res = await fetch(`${_CD_API}/api/v1/deposits`, {
            headers: { Authorization: `Bearer ${_cdToken()}` },
          });
          if (res.ok) {
            const json = await res.json();
            const latest = (json.data ?? []).find(
              (d: any) => d.paymentMethod === "crypto" && ["pending", "confirming"].includes(d.status)
            );
            if (latest) {
              setDeposit(latest);
              setStep("monitor");
              setTimeLeft(Math.max(0, new Date(latest.expiresAt).getTime() - Date.now()));
              return;
            }
          }
        } catch {}
      }
      // Fallback: local monitoring service
      const active = depositMonitoringService.getActiveDeposit(userId);
      if (active && active.method === "crypto") {
        setDeposit({
          id: active.id, requestedAmount: active.requestedAmount, memoAmount: active.memoAmount,
          paymentMethod: "crypto", paymentAddress: active.reference,
          status: active.status as any, expiresAt: new Date(active.expiresAt).toISOString(),
        });
        setStep("monitor");
        setTimeLeft(Math.max(0, active.expiresAt - Date.now()));
        return;
      }
      setStep("enter"); setDeposit(null); setAmount("");
    };

    restore();
  }, [open, userId]);

  // Poll backend for status updates on active deposits
  useEffect(() => {
    if (!deposit || !["pending", "confirming"].includes(deposit.status)) { stopPolling(); return; }
    stopPolling();
    pollRef.current = setInterval(() => pollStatus(deposit.id), 10_000);
    return stopPolling;
  }, [deposit?.id, deposit?.status, pollStatus]);

  // Countdown timer
  useEffect(() => {
    if (step !== "monitor" || !deposit) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(Math.max(0, new Date(deposit.expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, deposit?.expiresAt]);

  // Local monitoring service fallback status sync
  useEffect(() => {
    if (!deposit) return;
    const unsub = depositMonitoringService.onDepositStateChange((depositId, status) => {
      if (depositId === deposit.id) setDeposit((prev) => prev ? { ...prev, status: status as any } : null);
    });
    return unsub;
  }, [deposit?.id]);

  const handleGetAddress = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed < minDeposit) { toast.error(`Minimum crypto deposit is $${minDeposit}`); return; }
    setCreating(true);
    try {
      if (_CD_API && _cdToken()) {
        // walletAddress is NOT sent — backend reads it from CRYPTO_DEPOSIT_ADDRESS env var
        const res = await fetch(`${_CD_API}/api/v1/deposits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${_cdToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: parsed, method: "crypto" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.message ?? "Failed to create deposit session");
          return;
        }
        const json = await res.json();
        const d: BackendDeposit = json.data;
        setDeposit(d);
        setTimeLeft(Math.max(0, new Date(d.expiresAt).getTime() - Date.now()));
        setStep("monitor");
        onDepositInitiated(d.id, d.requestedAmount, d.memoAmount);
        toast.success("Deposit session created — valid for 30 minutes");
      } else {
        // Offline fallback (no wallet address available without backend)
        toast.error("Backend is not available. Crypto deposits require a server connection.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create deposit session");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (type: "address" | "memo") => {
    // Wallet address comes from deposit.paymentAddress (backend-supplied) — never from a frontend constant
    const text = type === "address"
      ? (deposit?.paymentAddress ?? "")
      : (deposit?.memoAmount.toString() ?? "");
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast.success(type === "address" ? "Wallet address copied!" : "Exact amount copied!");
  };

  const isExpired = timeLeft === 0 && step === "monitor";

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    confirming: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    completed: "bg-green-500/10 text-green-500 border-green-500/30",
    expired: "bg-red-500/10 text-red-500 border-red-500/30",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Crypto Deposit (USDT BEP-20)
          </DialogTitle>
          <DialogDescription>
            {step === "enter"
              ? "Enter the amount you want to deposit."
              : "Send the exact amount to complete your deposit."}
          </DialogDescription>
        </DialogHeader>

        {step === "enter" && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cd-amount">Deposit Amount (USD)</Label>
              <Input
                id="cd-amount"
                type="number"
                min={minDeposit}
                step="0.01"
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum: ${minDeposit.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-2.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Unique Amount Tracking</p>
              <p>You'll receive a unique amount (e.g., $100.053564) valid for 30 minutes. Send this exact amount to auto-credit your account.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleGetAddress}>Get Wallet Address</Button>
            </div>
          </div>
        )}

        {step === "monitor" && deposit && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* Status + timer row */}
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${
                  statusColor[isExpired ? "expired" : deposit.status]
                }`}
              >
                {isExpired ? "Expired" : deposit.status}
              </span>
              <span
                className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${
                  timeLeft < 5 * 60_000 ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {formatCountdown(timeLeft)}
              </span>
            </div>

            {isExpired ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500 text-center space-y-2">
                <p className="font-semibold">This deposit session has expired.</p>
                <p className="text-xs text-muted-foreground">Please start a new deposit request.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStep("enter");
                    setDeposit(null);
                    setAmount("");
                  }}
                >
                  New Deposit
                </Button>
              </div>
            ) : (
              <>
                {/* Amounts */}
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Requested Amount</span>
                    <span className="font-semibold">{formatCurrency(deposit.requestedAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
                    <div>
                      <p className="font-semibold text-primary">Send Exactly</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Unique amount — matches your session automatically
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary text-base">
                        ${deposit.memoAmount.toFixed(6)}
                      </span>
                      <button
                        onClick={() => handleCopy("memo")}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {copied === "memo" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Wallet address */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    USDT BEP-20 (BSC) Wallet Address
                  </Label>
                  <div className="rounded-lg bg-muted p-3 flex items-start gap-2">
                    <span className="flex-1 font-mono text-xs break-all leading-relaxed">
                      {deposit?.paymentAddress ?? "—"}
                    </span>
                    <button
                      onClick={() => handleCopy("address")}
                      className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {copied === "address" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Network: <span className="font-semibold text-foreground">Binance Smart Chain (BEP-20)</span>
                  </p>
                </div>

                {/* Status message */}
                {deposit.status === "pending" && (
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2.5 text-xs">
                    <p className="text-yellow-600 dark:text-yellow-400 font-medium">Waiting for payment...</p>
                    <p className="text-muted-foreground mt-1">Send exactly ${deposit.memoAmount.toFixed(6)} via BEP-20 network.</p>
                  </div>
                )}
                {deposit.status === "confirming" && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming transaction...
                    </div>
                    <p className="text-muted-foreground mt-1">Payment detected. Awaiting blockchain confirmations.</p>
                  </div>
                )}
                {deposit.status === "completed" && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Deposit confirmed!
                    </div>
                    <p className="text-muted-foreground mt-1">Funds have been credited to your Game Wallet.</p>
                  </div>
                )}
              </>
            )}

            {/* Important info */}
            {deposit.status !== "completed" && !isExpired && (
              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />Important</p>
                <p>• Send <strong className="text-foreground">ONLY USDT</strong> via BEP-20 (BSC) network.</p>
                <p>• Send the <strong className="text-foreground">exact amount</strong> shown above.</p>
                <p>• Sending a different amount may delay automatic crediting.</p>
                <p>• Sending via another network may result in <strong className="text-foreground">permanent loss of funds</strong>.</p>
                <p>• Deposit session expires after 30 minutes.</p>
                <p>• Credits occur automatically after blockchain confirmation.</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
