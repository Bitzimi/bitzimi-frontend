import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Copy, CheckCircle2, Clock, ShieldCheck, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { depositMonitoringService } from "../services/depositMonitoringService";

const _BD_API = (import.meta as any).env?.VITE_API_URL as string | undefined;
function _bdToken() { return localStorage.getItem("bitzimi_access_token"); }

// BANK_INFO is NEVER hardcoded here.
// Bank account details come from GET /api/v1/platform/config → bankReceivingAccount.
// This is identical in principle to how crypto deposit address is handled.

interface BackendBankDeposit {
  id: string;
  requestedAmount: number;
  memoAmount: number;
  paymentMethod: string;
  paymentAddress: string; // bank reference code
  status: "pending" | "confirming" | "completed" | "expired";
  expiresAt: string;
}

interface BankReceivingAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ngnToUsdRate: number;
  minimumNGN: number;
}

interface BankDepositDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  formatCurrency: (amount: number) => string;
  onDepositInitiated: (depositId: string, amountUSD: number, amountNGN: number, reference: string, bankName: string, ngnRate: number) => void;
  onDepositConfirmed?: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function BankDepositDialog({
  open, onClose, userId, formatCurrency, onDepositInitiated, onDepositConfirmed,
}: BankDepositDialogProps) {
  const [step, setStep] = useState<"enter" | "monitor">("enter");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState<BackendBankDeposit | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [creating, setCreating] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankReceivingAccount | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // NGN rate fallback when backend not reachable (display only — never used for settlement)
  const ngnRate = bankAccount?.ngnToUsdRate ?? 1347;
  const minimumNGN = bankAccount?.minimumNGN ?? 5000;

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollStatus = useCallback(async (depositId: string) => {
    if (!_BD_API || !_bdToken()) return;
    try {
      const res = await fetch(`${_BD_API}/api/v1/deposits/${depositId}`, {
        headers: { Authorization: `Bearer ${_bdToken()}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const d: BackendBankDeposit = json.data;
      setDeposit(d);
      if (d.status === "completed") { stopPolling(); onDepositConfirmed?.(); }
      else if (d.status === "expired") { stopPolling(); }
    } catch {}
  }, [onDepositConfirmed]);

  // On open: fetch platform config (bank account) + restore active deposit
  useEffect(() => {
    if (!open) return;

    // Always load bank receiving account from backend — never hardcoded
    if (_BD_API && _bdToken()) {
      fetch(`${_BD_API}/api/v1/platform/config`, {
        headers: { Authorization: `Bearer ${_bdToken()}` },
      })
        .then((r) => r.json())
        .then((j) => { if (j.data?.bankReceivingAccount) setBankAccount(j.data.bankReceivingAccount); })
        .catch(() => {});
    }

    const restore = async () => {
      if (_BD_API && _bdToken()) {
        try {
          const res = await fetch(`${_BD_API}/api/v1/deposits`, {
            headers: { Authorization: `Bearer ${_bdToken()}` },
          });
          if (res.ok) {
            const json = await res.json();
            const latest = (json.data ?? []).find(
              (d: any) => d.paymentMethod === "bank" && ["pending", "confirming"].includes(d.status)
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
      const active = depositMonitoringService.getActiveDeposit(userId);
      if (active && active.method === "bank") {
        setDeposit({
          id: active.id, requestedAmount: active.requestedAmount, memoAmount: active.memoAmount,
          paymentMethod: "bank", paymentAddress: active.reference,
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

  // Poll backend for status
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

  // Local monitoring fallback
  useEffect(() => {
    if (!deposit) return;
    const unsub = depositMonitoringService.onDepositStateChange((depositId, status) => {
      if (depositId === deposit.id) setDeposit((prev) => prev ? { ...prev, status: status as any } : null);
    });
    return unsub;
  }, [deposit?.id]);

  const handleGenerate = async () => {
    const parsedNGN = parseFloat(amount);
    if (!amount || isNaN(parsedNGN) || parsedNGN < minimumNGN) {
      toast.error(`Minimum bank deposit is ₦${minimumNGN.toLocaleString()}`);
      return;
    }
    const amountUSD = parsedNGN / ngnRate;
    setCreating(true);
    try {
      if (_BD_API && _bdToken()) {
        const res = await fetch(`${_BD_API}/api/v1/deposits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${_bdToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amountUSD, method: "bank" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.message ?? "Failed to create deposit session");
          return;
        }
        const json = await res.json();
        const d: BackendBankDeposit = json.data;
        setDeposit(d);
        setTimeLeft(Math.max(0, new Date(d.expiresAt).getTime() - Date.now()));
        setStep("monitor");
        onDepositInitiated(d.id, d.requestedAmount, parsedNGN, d.paymentAddress, bankAccount?.bankName ?? "", ngnRate);
        toast.success("Deposit session created — valid for 30 minutes");
      } else {
        // Offline fallback
        const newDeposit = depositMonitoringService.createBankDeposit(userId, amountUSD);
        setDeposit({
          id: newDeposit.id, requestedAmount: newDeposit.requestedAmount, memoAmount: newDeposit.memoAmount,
          paymentMethod: "bank", paymentAddress: newDeposit.reference,
          status: "pending", expiresAt: new Date(newDeposit.expiresAt).toISOString(),
        });
        setTimeLeft(Math.max(0, newDeposit.expiresAt - Date.now()));
        setStep("monitor");
        onDepositInitiated(newDeposit.id, amountUSD, parsedNGN, newDeposit.reference, bankAccount?.bankName ?? "", ngnRate);
        toast.success("Deposit session created — valid for 30 minutes");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create deposit session");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${label} copied!`);
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
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Bank Deposit (Nigerian Banks)
          </DialogTitle>
          <DialogDescription>
            {step === "enter"
              ? "Enter the amount in Naira (₦) you want to deposit."
              : "Transfer funds to the account below using your bank app or USSD."}
          </DialogDescription>
        </DialogHeader>

        {step === "enter" && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bd-amount">Deposit Amount (₦ Naira)</Label>
              <Input
                id="bd-amount"
                type="number"
                min="5000"
                step="100"
                placeholder="e.g. 134,700"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum: ₦{minimumNGN.toLocaleString()}</p>
            </div>

            {/* Conversion preview */}
            {amount && parseFloat(amount) >= 5000 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">You'll receive</span>
                  <span className="font-bold text-primary">
                    ${(parseFloat(amount) / ngnRate).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Exchange rate: ₦{ngnRate.toLocaleString()} = $1
                </p>
              </div>
            )}

            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Currency Conversion
              </p>
              <p>• Bank deposits are in Naira (₦) and converted to USD automatically</p>
              <p>• Credited to your <strong>Game Wallet</strong> in USD equivalent</p>
              <p>• System exchange rate applies at time of confirmation</p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleGenerate}>Generate Account Details</Button>
            </div>
          </div>
        )}

        {step === "monitor" && deposit && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* Status + timer */}
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
                  onClick={() => { setStep("enter"); setDeposit(null); setAmount(""); }}
                >
                  New Deposit
                </Button>
              </div>
            ) : (
              <>
                {/* Amount summary */}
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex justify-between px-4 py-3 bg-primary/5">
                    <span className="text-muted-foreground">Transfer Amount</span>
                    <span className="font-bold text-primary text-base">
                      ₦{(deposit.requestedAmount * ngnRate).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">USD Equivalent</span>
                    <span className="font-medium">{formatCurrency(deposit.requestedAmount)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span className="font-medium text-xs">₦{ngnRate.toLocaleString()} = $1</span>
                  </div>
                </div>

                {/* Bank details — from backend (never hardcoded) */}
                <div className="rounded-lg border divide-y text-sm">
                  {bankAccount ? (
                    [
                      { label: "Bank Name",    value: bankAccount.bankName },
                      { label: "Account Name", value: bankAccount.accountName },
                      { label: "Account Number", value: bankAccount.accountNumber },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center px-4 py-3">
                        <span className="text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{value}</span>
                          <button
                            onClick={() => handleCopy(label, value)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            {copied === label ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading bank details…
                    </div>
                  )}
                  {/* Unique reference */}
                  <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
                    <div>
                      <p className="font-semibold text-primary">Payment Reference</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Must include in transfer narration</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary tracking-wider">
                        {deposit.paymentAddress}
                      </span>
                      <button
                        onClick={() => handleCopy("Reference", deposit.paymentAddress)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {copied === "Reference" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1"><Info className="h-3.5 w-3.5" />Important</p>
                  <p>• Transfer from ANY Nigerian bank using the account details above.</p>
                  <p>• Include the <strong className="text-foreground">Payment Reference</strong> in narration/description.</p>
                  <p>• Amount will be converted to USD and credited to your <strong className="text-foreground">Game Wallet</strong>.</p>
                  <p>• Tracking is automatic — you can close this window safely.</p>
                  <p>• Deposit session expires after 30 minutes.</p>
                  <p>• Transfers after expiration may require manual verification.</p>
                </div>

                {deposit.status === "confirming" && (
                  <div className="flex items-center gap-2 text-sm text-blue-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Payment detected — confirming transaction...
                  </div>
                )}
              </>
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
