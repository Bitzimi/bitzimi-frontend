/**
 * WithdrawalWizard — single modal state machine for the entire withdrawal flow.
 *
 * Steps: method → phone → bank_setup / wallet_setup → pin_setup → form → confirm_pin → success
 *
 * Rules:
 * - ONE modal overlay, no stacked dialogs
 * - Backdrop click is blocked during active steps
 * - Step state is persisted to localStorage (resumes on re-open)
 * - No navigate() calls — everything is inline
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  ShieldCheck, Building2, Lock, CheckCircle2, Phone, Wallet as WalletIcon,
  ArrowLeft, Info, Loader2, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { depositMonitoringService } from "../services/depositMonitoringService";
import { userProfileService } from "../services/userProfileService";
import { phoneVerificationService } from "../services/phoneVerificationService";
import { SUPPORTED_COUNTRIES, getCountryByCode } from "../constants/countries";
import { useGeoLocation } from "../hooks/useGeoLocation";
import { dispatchIdentityUpdate } from "../contexts/IdentityContext";
import { useNotifications } from "../contexts/NotificationContext";
import { maskWalletAddress, maskBankAccount } from "../utils/formatUtils";
import { withdrawalLimitService, TIER_LIMITS, type UserTier } from "../services/withdrawalLimitService";

// ─── Backend helpers ──────────────────────────────────────────────────────────
const _WW_API = (import.meta as any).env?.VITE_API_URL as string | undefined;
function _wwToken() { return localStorage.getItem("bitzimi_access_token"); }
async function _wwFetch(path: string, opts?: RequestInit) {
  const token = _wwToken();
  if (!_WW_API || !token) return null;
  const res = await fetch(`${_WW_API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `API error ${res.status}`);
  }
  return res.json();
}

// ─── Constants (display-only fallbacks — backend is authoritative at submission) ─
const FEE_BANK_NGN = 1500;          // ₦1,500 fixed bank fee (correct)
const NGN_TO_USD_FALLBACK = 1650;   // fallback NGN rate; backend Currency Management is authoritative
const FEE_CRYPTO_USD_FALLBACK = 1;  // $1 flat crypto fee (matches config default)
const MIN_WITHDRAWAL_USD_FALLBACK = 7; // $7 minimum (matches config default)
const WEAK_PINS = [
  "0000","1111","2222","3333","4444","5555","6666","7777","8888","9999",
  "1234","4321","0123","9876","2345","3456","4567","5678","6789",
];
const PERSIST_KEY = "bitzimiWithdrawalWizardState";

// ─── Types ────────────────────────────────────────────────────────────────────
type WizardStep =
  | "method"
  | "phone"
  | "bank_setup"
  | "wallet_setup"
  | "pin_setup"
  | "form"
  | "confirm_pin"
  | "submitting"
  | "success";

type WithdrawMethod = "bank" | "crypto";

export interface WithdrawalCompletedParams {
  withdrawalId: string;
  method: WithdrawMethod;
  amountUSD: number;
  bankDetails?: { bankName: string; accountName: string; accountNumber: string };
  walletAddress?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userBalance: number;
  isNigerian: boolean;
  userTier: UserTier;
  formatCurrency: (amount: number) => string;
  onBalanceDeduct: (amount: number) => void;
  onCompleted: (params: WithdrawalCompletedParams) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadPersisted(): { step?: WizardStep; method?: WithdrawMethod; amount?: string } {
  try { return JSON.parse(localStorage.getItem(PERSIST_KEY) || "{}"); }
  catch { return {}; }
}
function savePersisted(data: { step: WizardStep; method?: WithdrawMethod; amount?: string }) {
  localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
}
function clearPersisted() { localStorage.removeItem(PERSIST_KEY); }

// ─── PIN display boxes ────────────────────────────────────────────────────────
function PinBoxes({ value, error }: { value: string; error?: boolean }) {
  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl transition-all duration-150 ${
          value.length > i
            ? error
              ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600"
              : "border-primary bg-primary/8 text-primary"
            : i === value.length
            ? "border-primary/50 ring-2 ring-primary/15"
            : "border-border"
        }`}>
          {value.length > i ? "●" : ""}
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WithdrawalWizard({
  open, onClose, userId, userBalance, isNigerian, userTier,
  formatCurrency, onBalanceDeduct, onCompleted,
}: Props) {
  const geo = useGeoLocation();
  const { addNotification } = useNotifications();

  // ── Core wizard state ──
  const [step, setStep] = useState<WizardStep>("method");
  const [method, setMethod] = useState<WithdrawMethod | null>(null);

  // ── Phone verification ──
  const [phoneSubStep, setPhoneSubStep] = useState<"number" | "code">("number");
  const [selectedCode, setSelectedCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [actualCode, setActualCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // ── Bank setup ──
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // ── Wallet setup ──
  const [walletAddress, setWalletAddress] = useState("");

  // ── PIN setup ──
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSetupError, setPinSetupError] = useState("");

  // ── Form + confirm ──
  const [amount, setAmount] = useState("");
  const [enteredPin, setEnteredPin] = useState("");
  const [pinConfirmError, setPinConfirmError] = useState("");
  const pinInputRef = useRef<HTMLInputElement>(null);

  // ── Summary (for success screen) ──
  const [finalRef, setFinalRef] = useState("");

  // ── Exit confirm ──
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ── Backend limits (override localStorage service when available) ──
  const [backendLimits, setBackendLimits] = useState<{
    tier: string;
    dailyLimit: number; monthlyLimit: number;
    dailyUsed: number; monthlyUsed: number;
    dailyRemaining: number; monthlyRemaining: number;
    minimumWithdrawal?: number;
    fees?: { bank: number; crypto: number };
  } | null>(null);

  // ── PIN existence flag (backend authoritative, localStorage fallback) ──
  const [pinIsSet, setPinIsSet] = useState<boolean>(false);

  // ─── Countdown timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ─── On open: determine starting step ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const persisted = loadPersisted();

    // Always re-check real prerequisites from fresh storage
    const profile = userProfileService.getProfile();
    const phoneVerified = profile?.phoneVerified || false;

    if (!phoneVerified) {
      setStep("phone");
      setPhoneSubStep("number");
      // Auto-detect country
      if (!geo.loading && geo.countryCode) {
        const c = getCountryByCode(geo.countryCode);
        setSelectedCode(c?.phoneCode ?? "+1");
      }
      return;
    }

    // Restore method if persisted, otherwise show method selection
    if (persisted.method) {
      setMethod(persisted.method);
      if (persisted.amount) setAmount(persisted.amount);
      // Re-check remaining setup steps
      advanceFromMethod(persisted.method, false).catch(() => {});
    } else {
      setStep("method");
    }
  }, [open]);

  // ─── Auto-detect country for phone step ──────────────────────────────────
  useEffect(() => {
    if (step === "phone" && !geo.loading && geo.countryCode) {
      const c = getCountryByCode(geo.countryCode);
      if (c) setSelectedCode(c.phoneCode);
    }
  }, [step, geo.loading, geo.countryCode]);

  // ─── Focus PIN input when entering confirm step ───────────────────────────
  useEffect(() => {
    if (step === "confirm_pin") {
      setEnteredPin("");
      setPinConfirmError("");
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [step]);

  // ─── Load backend limits when form step is shown ──────────────────────────
  useEffect(() => {
    if (step !== "form") return;
    _wwFetch("/api/v1/withdrawals/limits")
      .then((json) => { if (json?.data) setBackendLimits(json.data); })
      .catch(() => {});
  }, [step]);

  // ─── Step advancement logic ───────────────────────────────────────────────
  const advanceFromMethod = useCallback(async (m: WithdrawMethod, saveToStorage = true) => {
    if (saveToStorage) savePersisted({ step: "method", method: m });

    // Try to load payment settings from backend first, fall back to localStorage
    let backendPayment: any = null;
    try {
      const res = await _wwFetch("/api/v1/users/me/payment");
      backendPayment = res?.data;
    } catch {}

    const bankConfigured = backendPayment?.bankAccountNumber
      || !!localStorage.getItem("bitzimiBankDetails");
    const walletConfigured = backendPayment?.usdtAddress
      || !!localStorage.getItem("bitzimiUSDTAddress");
    const pinSet = !!(backendPayment?.hasPIN);
    setPinIsSet(pinSet);

    if (m === "bank") {
      if (!bankConfigured) { setStep("bank_setup"); return; }
      if (backendPayment?.bankAccountNumber) {
        setBankName(backendPayment.bankName || "");
        setAccountName(backendPayment.bankAccountName || "");
        setAccountNumber(backendPayment.bankAccountNumber || "");
      } else {
        try {
          const d = JSON.parse(localStorage.getItem("bitzimiBankDetails")!);
          setBankName(d.bankName || ""); setAccountName(d.accountName || ""); setAccountNumber(d.accountNumber || "");
        } catch {}
      }
    } else {
      if (!walletConfigured) { setStep("wallet_setup"); return; }
      setWalletAddress(backendPayment?.usdtAddress || localStorage.getItem("bitzimiUSDTAddress") || "");
    }

    if (!pinSet) { setStep("pin_setup"); return; }

    // Check for existing pending withdrawal (local monitoring service)
    const active = depositMonitoringService.getActiveWithdrawal(userId);
    if (active && active.method === m) {
      setFinalRef(active.id.slice(-8).toUpperCase());
      setAmount(active.amount.toString());
      setStep("success");
      return;
    }

    setStep("form");
  }, [userId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectMethod = (m: WithdrawMethod) => {
    setMethod(m);
    advanceFromMethod(m, true).catch(() => {});
  };

  const handleSendSMS = () => {
    if (!phoneNumber || phoneNumber.length < 5) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSendingSMS(true);
    const full = `${selectedCode}${phoneNumber.trim()}`;
    const result = phoneVerificationService.sendVerificationCode(full);
    setSendingSMS(false);
    if (result.success) {
      toast.success("Verification code sent");
      setPhoneSubStep("code");
      setCountdown(300);
      setActualCode(result.code ?? "");
    } else {
      toast.error(result.message);
    }
  };

  const handleVerifyPhone = () => {
    const result = phoneVerificationService.verifyCode(smsCode);
    if (!result.success) { toast.error(result.message); return; }

    userProfileService.updatePhone(selectedCode, phoneNumber);
    const country = SUPPORTED_COUNTRIES.find(c => c.phoneCode === selectedCode);
    userProfileService.verifyPhone(country?.code ?? "", country?.name ?? "");
    dispatchIdentityUpdate();

    toast.success("Phone verified!");
    addNotification("success", "Phone Number Verified",
      `${selectedCode} ${phoneNumber} has been verified successfully.`,
      { type: "phone_verification" }
    );
    // Determine next step
    setStep("method");
    setPhoneSubStep("number");
    setSmsCode("");
  };

  const handleSaveBankDetails = () => {
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      toast.error("Please fill in all bank account details");
      return;
    }
    if (accountNumber.replace(/\D/g, "").length < 8) {
      toast.error("Account number must be at least 8 digits");
      return;
    }
    const d = { bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim() };
    localStorage.setItem("bitzimiBankDetails", JSON.stringify(d));
    localStorage.setItem("bitzimiBankSavedAt", new Date().toISOString());
    window.dispatchEvent(new CustomEvent("identity-updated"));
    // Also persist to backend payment settings
    _wwFetch("/api/v1/users/me/payment", {
      method: "PATCH",
      body: JSON.stringify({ bankAccountName: d.accountName, bankAccountNumber: d.accountNumber, bankName: d.bankName }),
    }).catch(() => {});
    toast.success("Bank account saved");
    addNotification("security", "Bank Account Added",
      `${d.bankName} account has been saved for withdrawals.`,
      { type: "bank_setup" }
    );
    setStep(pinIsSet ? "form" : "pin_setup");
  };

  const handleSaveWallet = () => {
    const addr = walletAddress.trim();
    if (!addr || addr.length < 20) {
      toast.error("Please enter a valid USDT BEP-20 wallet address");
      return;
    }
    localStorage.setItem("bitzimiUSDTAddress", addr);
    localStorage.setItem("bitzimiUSDTSavedAt", new Date().toISOString());
    window.dispatchEvent(new CustomEvent("identity-updated"));
    // Also persist to backend payment settings
    _wwFetch("/api/v1/users/me/payment", {
      method: "PATCH",
      body: JSON.stringify({ usdtAddress: addr }),
    }).catch(() => {});
    toast.success("Wallet address saved");
    addNotification("security", "Crypto Wallet Added",
      "Your USDT BEP-20 withdrawal address has been saved.",
      { type: "wallet_setup" }
    );
    setStep(pinIsSet ? "form" : "pin_setup");
  };

  const handleSavePin = async () => {
    setPinSetupError("");
    if (newPin.length !== 4) { setPinSetupError("PIN must be exactly 4 digits"); return; }
    if (newPin !== confirmPin) { setPinSetupError("PINs do not match"); return; }
    if (WEAK_PINS.includes(newPin)) { setPinSetupError("PIN is too predictable. Try a different combination."); return; }
    // Save to backend first, then local cache
    try {
      await _wwFetch("/api/v1/users/me/security-pin", { method: "POST", body: JSON.stringify({ pin: newPin }) });
    } catch {}
    setPinIsSet(true);
    toast.success("Security PIN created");
    addNotification("security", "Security PIN Created",
      "Your 4-digit security PIN has been set. It is required for all withdrawals.",
      { type: "pin_set" }
    );
    setNewPin(""); setConfirmPin("");
    setStep("form");
  };

  const parsedUSD = parseFloat(amount) || 0;
  // Use backend-provided fees when available; fall back to correct config defaults.
  // Backend is authoritative at submission — these values are display + pre-flight only.
  const feeBankUSD   = backendLimits?.fees?.bank   ?? (FEE_BANK_NGN / NGN_TO_USD_FALLBACK);
  const feeCryptoUSD = backendLimits?.fees?.crypto  ?? FEE_CRYPTO_USD_FALLBACK;
  const feeUSD = method === "bank" ? feeBankUSD : feeCryptoUSD;
  const netUSD = Math.max(0, parsedUSD - feeUSD);
  // Derive NGN display rate: if backend supplied bank fee in USD, back-calculate rate.
  const ngnToUsd   = backendLimits?.fees?.bank ? FEE_BANK_NGN / backendLimits.fees.bank : NGN_TO_USD_FALLBACK;
  const parsedNGN  = parsedUSD * ngnToUsd;
  const netNGN     = Math.max(0, parsedNGN - FEE_BANK_NGN);
  const minWithdrawal = backendLimits?.minimumWithdrawal ?? MIN_WITHDRAWAL_USD_FALLBACK;

  const handleSubmitForm = () => {
    if (!amount || parsedUSD <= 0) { toast.error("Please enter an amount"); return; }
    if (parsedUSD < minWithdrawal) { toast.error(`Minimum withdrawal is $${minWithdrawal}`); return; }
    if (parsedUSD > userBalance) { toast.error("Insufficient balance"); return; }

    // Check limits: prefer backend data, fall back to localStorage service
    if (backendLimits) {
      if (parsedUSD > backendLimits.dailyRemaining) {
        toast.error(`Daily withdrawal limit exceeded. Remaining today: $${backendLimits.dailyRemaining.toLocaleString()}`);
        return;
      }
      if (parsedUSD > backendLimits.monthlyRemaining) {
        toast.error(`Monthly withdrawal limit exceeded. Remaining this month: $${backendLimits.monthlyRemaining.toLocaleString()}`);
        return;
      }
    } else {
      const limitCheck = withdrawalLimitService.check(parsedUSD, userTier);
      if (!limitCheck.allowed) { toast.error(limitCheck.reason); return; }
    }

    savePersisted({ step: "confirm_pin", method: method!, amount });
    setStep("confirm_pin");
  };

  // Accept an optional explicit pin value to avoid stale-closure reads from auto-submit.
  const handleConfirmPin = async (pinOverride?: string) => {
    const pinToCheck = pinOverride ?? enteredPin;
    setPinConfirmError("");
    setStep("submitting");

    const dest = method === "bank"
      ? `${bankName} | ${accountName} | ${accountNumber}`
      : walletAddress;

    try {
      if (_WW_API && _wwToken()) {
        // ── Backend-authoritative path ──────────────────────────────────────
        // Step 1: verify PIN → receive one-time token
        let pinToken: string;
        try {
          const verifyRes = await _wwFetch("/api/v1/users/me/security-pin/verify", {
            method: "POST",
            body: JSON.stringify({ pin: pinToCheck }),
          });
          pinToken = verifyRes?.data?.token;
          if (!pinToken) throw new Error("No pin token received");
        } catch (err: any) {
          setPinConfirmError(err?.message?.includes("Invalid") || err?.message?.includes("incorrect")
            ? "Incorrect PIN. Please try again."
            : (err?.message ?? "PIN verification failed"));
          setEnteredPin("");
          setStep("confirm_pin");
          return;
        }

        // Step 2: submit withdrawal — backend debits main wallet atomically
        let withdrawal: any;
        try {
          const wRes = await _wwFetch("/api/v1/withdrawals", {
            method: "POST",
            body: JSON.stringify({
              amount: parsedUSD,
              destination: dest,
              method: method!,
              pinToken,
            }),
          });
          withdrawal = wRes?.data;
        } catch (err: any) {
          setPinConfirmError(err?.message ?? "Withdrawal failed");
          setStep("confirm_pin");
          return;
        }

        const ref = (withdrawal?.id ?? "").slice(-8).toUpperCase();
        setFinalRef(ref || "SUBMITTED");
        onBalanceDeduct(parsedUSD); // triggers refreshWalletsFromBackend in parent
        onCompleted({
          withdrawalId: withdrawal?.id ?? "pending",
          method: method!,
          amountUSD: parsedUSD,
          ...(method === "bank" ? { bankDetails: { bankName, accountName, accountNumber } } : { walletAddress }),
        });
        // Also update local limit cache so the UI shows updated remaining immediately
        withdrawalLimitService.record(parsedUSD);
      } else {
        // Withdrawals are always backend-authoritative. Reject if API is unavailable.
        setPinConfirmError("Cannot process withdrawal: no connection to server. Please try again.");
        setStep("confirm_pin");
        return;
      }

      clearPersisted();
      setTimeout(() => setStep("success"), 800);
    } catch (err: any) {
      setPinConfirmError(err?.message ?? "Withdrawal failed. Please try again.");
      setStep("confirm_pin");
    }
  };

  // ─── Close / exit guard ──────────────────────────────────────────────────
  const safeToClose = step === "method" || step === "success";
  const handleRequestClose = () => {
    if (safeToClose) {
      handleReset();
      onClose();
    } else {
      setShowExitConfirm(true);
    }
  };

  const handleReset = () => {
    setStep("method"); setMethod(null); setAmount("");
    setPhoneSubStep("number"); setPhoneNumber(""); setSmsCode(""); setCountdown(0);
    setBankName(""); setAccountName(""); setAccountNumber("");
    setWalletAddress(""); setNewPin(""); setConfirmPin(""); setPinSetupError("");
    setEnteredPin(""); setPinConfirmError(""); setFinalRef("");
    setShowExitConfirm(false);
  };

  const handleForceClose = () => {
    clearPersisted();
    handleReset();
    onClose();
  };

  // ─── Progress ─────────────────────────────────────────────────────────────
  const allSteps: WizardStep[] = ["method", "phone", "bank_setup", "wallet_setup", "pin_setup", "form", "confirm_pin", "submitting", "success"];
  const activeSteps: WizardStep[] = ["form", "confirm_pin", "submitting", "success"];
  const setupSteps: WizardStep[] = ["phone", "bank_setup", "wallet_setup", "pin_setup"];
  const currentSetupIdx = setupSteps.indexOf(step);
  const isSetupStep = currentSetupIdx >= 0;
  const isActiveStep = activeSteps.includes(step);

  const filteredCountries = countrySearch.trim()
    ? SUPPORTED_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.phoneCode.includes(countrySearch) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : SUPPORTED_COUNTRIES;

  const selectedCountry = SUPPORTED_COUNTRIES.find(c => c.phoneCode === selectedCode);

  // ─── Titles ───────────────────────────────────────────────────────────────
  const titles: Record<WizardStep, { title: string; description: string }> = {
    method:       { title: "Withdraw Funds",         description: "Choose your withdrawal method." },
    phone:        { title: "Verify Phone Number",    description: "Required to enable withdrawals on your account." },
    bank_setup:   { title: "Add Bank Account",       description: "Your bank details are saved locally and encrypted." },
    wallet_setup: { title: "Add USDT Wallet",        description: "Enter your USDT BEP-20 destination address." },
    pin_setup:    { title: "Create Security PIN",    description: "A 4-digit PIN is required to authorize withdrawals." },
    form:         { title: "Withdrawal Amount",      description: "Enter the amount you wish to withdraw." },
    confirm_pin:  { title: "Confirm Withdrawal",     description: "Enter your PIN to authorize this withdrawal." },
    submitting:   { title: "Submitting…",            description: "Please wait while we process your request." },
    success:      { title: "Withdrawal Submitted",   description: "Your withdrawal is being processed." },
  };
  const { title, description } = titles[step];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleRequestClose(); }}>
        <DialogContent
          className="sm:max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden"
          onInteractOutside={(e) => { if (!safeToClose) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (!safeToClose) e.preventDefault(); }}
        >
          {/* Fixed header */}
          <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4.5 w-4.5 text-primary shrink-0" />
                    {title}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">{description}</DialogDescription>
                </DialogHeader>
              </div>
              {safeToClose && (
                <button
                  onClick={() => { handleReset(); onClose(); }}
                  className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Setup progress bar */}
            {isSetupStep && (
              <div className="flex items-center gap-1.5 mt-3">
                {setupSteps.map((s, i) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < currentSetupIdx ? "bg-primary" : i === currentSetupIdx ? "bg-primary/55" : "bg-muted"
                  }`} />
                ))}
                <span className="text-[11px] text-muted-foreground shrink-0 ml-1">
                  Setup {currentSetupIdx + 1}/{setupSteps.length}
                </span>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* ── Method selection ── */}
            {step === "method" && (
              <div className="space-y-3">
                {/* Bank option — geo-gated */}
                {isNigerian ? (
                  <button
                    onClick={() => handleSelectMethod("bank")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 group text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Building2 className="h-5.5 w-5.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">Bank Withdrawal</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Usually within 1 hour · ₦{FEE_BANK_NGN.toLocaleString()} fee</p>

                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-4 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/15 opacity-60 cursor-not-allowed">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5.5 w-5.5 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Bank Withdrawal</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Unavailable in your region</p>
                    </div>
                  </div>
                )}

                {/* Crypto option — always available */}
                <button
                  onClick={() => handleSelectMethod("crypto")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="text-orange-600 dark:text-orange-400 font-bold text-xl">₮</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">Crypto Withdrawal</p>
                    <p className="text-xs text-muted-foreground mt-0.5">USDT BEP-20 · 5–30 min · ${FEE_CRYPTO_USD_FALLBACK} fee</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>

                <p className="text-xs text-muted-foreground text-center pt-1">
                  Available balance: <span className="font-medium text-foreground">{formatCurrency(userBalance)}</span>
                </p>
              </div>
            )}

            {/* ── Phone verification ── */}
            {step === "phone" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-orange-500/8 border border-orange-500/20 p-3.5 flex items-start gap-3">
                  <Phone className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A verified phone number protects your account and is required before withdrawing.
                  </p>
                </div>

                {phoneSubStep === "number" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Phone Number</Label>
                      <div className="flex h-12 rounded-xl border border-input overflow-hidden focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary transition-all">
                        {/* Country code selector */}
                        <div className="relative group">
                          <select
                            value={selectedCode}
                            onChange={e => { setSelectedCode(e.target.value); setPhoneNumber(""); }}
                            className="h-full pl-3 pr-7 text-sm font-medium bg-muted border-r border-input appearance-none outline-none cursor-pointer min-w-[90px]"
                          >
                            {SUPPORTED_COUNTRIES.map(c => (
                              <option key={c.code} value={c.phoneCode}>
                                {c.flag} {c.phoneCode}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs">▾</div>
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={phoneNumber}
                          onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                          placeholder={selectedCountry?.placeholder ?? "Phone number"}
                          className="flex-1 h-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60"
                          onKeyDown={e => e.key === "Enter" && handleSendSMS()}
                        />
                      </div>
                      {selectedCountry && (
                        <p className="text-xs text-muted-foreground">
                          {selectedCountry.flag} {selectedCountry.name}
                          {selectedCountry.digits ? ` · ${selectedCountry.digits} digits` : ""}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {phoneSubStep === "code" && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4">
                      <p className="text-xs font-medium text-foreground mb-2">Code sent to {selectedCode} {phoneNumber}</p>
                      <div className="bg-background rounded-lg p-3 text-center font-mono text-xl font-bold tracking-[0.5em] text-primary">
                        {actualCode}
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Enter 6-digit code</Label>
                      <Input
                        value={smsCode}
                        onChange={e => setSmsCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••••"
                        maxLength={6}
                        className="h-12 text-center tracking-[0.5em] text-xl font-mono"
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && smsCode.length === 6 && handleVerifyPhone()}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bank setup ── */}
            {step === "bank_setup" && (
              <>
                <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-3.5 flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your bank account details are stored locally on this device and used for all future withdrawals.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Name</Label>
                  <Input placeholder="e.g. First Bank" value={bankName} onChange={e => setBankName(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Holder Name</Label>
                  <Input placeholder="Full name as on account" value={accountName} onChange={e => setAccountName(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Number</Label>
                  <Input
                    placeholder="Account number (8–10 digits)"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    className="h-11 font-mono tracking-widest"
                    inputMode="numeric"
                  />
                </div>
              </>
            )}

            {/* ── Wallet setup ── */}
            {step === "wallet_setup" && (
              <>
                <div className="rounded-xl bg-orange-500/8 border border-orange-500/20 p-3.5 flex items-start gap-3">
                  <WalletIcon className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                    <p>Enter your USDT BEP-20 wallet address. Only BEP-20 (Binance Smart Chain) addresses are supported.</p>
                    <p className="text-amber-600 dark:text-amber-400 font-medium">⚠ Sending to a wrong address results in permanent loss of funds.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>USDT BEP-20 Address</Label>
                  <Input
                    placeholder="0x..."
                    value={walletAddress}
                    onChange={e => setWalletAddress(e.target.value.trim())}
                    className="h-11 font-mono text-sm"
                    spellCheck={false}
                    autoCapitalize="none"
                  />
                  <p className="text-xs text-muted-foreground">Must start with 0x · Binance Smart Chain only</p>
                </div>
              </>
            )}

            {/* ── PIN setup ── */}
            {step === "pin_setup" && (
              <>
                <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3.5 flex items-start gap-3">
                  <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your 4-digit PIN is required every time you withdraw. Choose something memorable but not obvious.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>New PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={newPin}
                    onChange={e => { setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinSetupError(""); }}
                    className="h-11 text-center font-mono tracking-[0.5em] text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinSetupError(""); }}
                    className="h-11 text-center font-mono tracking-[0.5em] text-lg"
                  />
                </div>
                {pinSetupError && <p className="text-xs text-red-500">{pinSetupError}</p>}
              </>
            )}

            {/* ── Withdrawal form ── */}
            {step === "form" && (
              <>
                {/* Destination card */}
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    {method === "bank" ? "Destination Account" : "Destination Wallet"}
                  </p>
                  {method === "bank" ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank</span>
                        <span className="font-medium">{bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Name</span>
                        <span className="font-medium">{accountName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Number</span>
                        <span className="font-mono font-medium">{maskBankAccount(accountNumber)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Network</span>
                        <span className="font-medium">BEP-20 (BSC)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span className="font-mono font-medium text-right">{maskWalletAddress(walletAddress)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Balance + Limits */}
                <div className="rounded-xl bg-muted divide-y divide-border text-sm overflow-hidden">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Available Balance</span>
                    <span className="font-semibold">{formatCurrency(userBalance)}</span>
                  </div>
                  {(() => {
                    // Prefer backend limits; fall back to localStorage service
                    const dailyRemaining   = backendLimits?.dailyRemaining   ?? withdrawalLimitService.getRemaining(userTier).dailyRemaining;
                    const monthlyRemaining = backendLimits?.monthlyRemaining  ?? withdrawalLimitService.getRemaining(userTier).monthlyRemaining;
                    const dailyLimit       = backendLimits?.dailyLimit        ?? TIER_LIMITS[userTier].daily;
                    const monthlyLimit     = backendLimits?.monthlyLimit      ?? TIER_LIMITS[userTier].monthly;
                    return (
                      <>
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">Daily Remaining</span>
                          <span className={`font-medium tabular-nums ${dailyRemaining < 10 ? "text-red-500" : "text-foreground"}`}>
                            ${dailyRemaining.toLocaleString()} / ${dailyLimit.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-muted-foreground">Monthly Remaining</span>
                          <span className={`font-medium tabular-nums ${monthlyRemaining < 10 ? "text-red-500" : "text-foreground"}`}>
                            ${monthlyRemaining.toLocaleString()} / ${monthlyLimit.toLocaleString()}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <Label>Withdrawal Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
                    <Input
                      type="number"
                      min={minWithdrawal}
                      step="0.01"
                      max={userBalance}
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="h-12 pl-7 text-base font-mono tabular-nums"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum: ${minWithdrawal}</p>
                </div>

                {/* Fee breakdown */}
                {parsedUSD > 0 && (
                  <div className="rounded-xl border border-border divide-y text-sm overflow-hidden">
                    {method === "bank" && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-muted-foreground">Amount (NGN)</span>
                        <span className="font-semibold">₦{parsedNGN.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="text-red-500">
                        {method === "bank" ? `−₦${FEE_BANK_NGN.toLocaleString()}` : `−${formatCurrency(feeCryptoUSD)}`}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 bg-primary/5">
                      <span className="font-semibold">You Receive</span>
                      <span className="font-bold text-primary">
                        {method === "bank"
                          ? `₦${netNGN.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                          : `${formatCurrency(netUSD)} USDT`}
                      </span>
                    </div>
                    {method === "bank" && (
                      <div className="flex justify-between px-4 py-2.5 text-xs">
                        <span className="text-muted-foreground">Rate</span>
                        <span className="text-muted-foreground">₦{Math.round(ngnToUsd).toLocaleString()} = $1</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Info</p>
                  {method === "bank"
                    ? <><p>• Processing: Usually within 1 hour</p><p>• Fixed fee: ₦{FEE_BANK_NGN.toLocaleString()}</p></>
                    : <><p>• Processing: 5–30 minutes</p><p>• Network fee: ${feeCryptoUSD.toFixed(2)}</p><p>• BEP-20 only</p></>}
                </div>
              </>
            )}

            {/* ── PIN confirmation ── */}
            {step === "confirm_pin" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">{formatCurrency(parsedUSD)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You Receive</span>
                    <span className="font-bold text-primary">
                      {method === "bank"
                        ? `₦${netNGN.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                        : `${formatCurrency(netUSD)} USDT`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium font-mono text-right max-w-[60%] truncate">
                      {method === "bank" ? `${bankName} · ${maskBankAccount(accountNumber)}` : maskWalletAddress(walletAddress)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-center text-muted-foreground">Enter your 4-digit security PIN</p>
                  <PinBoxes value={enteredPin} error={!!pinConfirmError} />
                  {pinConfirmError && <p className="text-xs text-red-500 text-center">{pinConfirmError}</p>}
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={enteredPin}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setEnteredPin(v);
                      setPinConfirmError("");
                      if (v.length === 4) {
                        // Pass fresh v directly — avoids stale-closure reading old enteredPin state
                        setTimeout(() => handleConfirmPin(v), 150);
                      }
                    }}
                    className="opacity-0 absolute h-0 w-0 overflow-hidden"
                    aria-label="Enter PIN"
                  />
                  <button
                    onClick={() => pinInputRef.current?.focus()}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                  >
                    Tap here to enter PIN
                  </button>
                </div>
              </div>
            )}

            {/* ── Submitting ── */}
            {step === "submitting" && (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-16 h-16 border-4 border-border border-t-primary rounded-full animate-spin" />
                <div className="text-center">
                  <p className="font-semibold">Processing Withdrawal</p>
                  <p className="text-sm text-muted-foreground mt-1">Please don't close this window…</p>
                </div>
              </div>
            )}

            {/* ── Success ── */}
            {step === "success" && (
              <div className="space-y-5">
                <div className="flex flex-col items-center py-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-lg">Withdrawal Submitted</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {method === "bank" ? "usually completed within 1 hour." : "Processing within 5–30 minutes."}
                  </p>
                </div>

                <div className="rounded-2xl border border-border divide-y text-sm overflow-hidden">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono font-medium">{finalRef}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-yellow-500">Processing</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{formatCurrency(parsedUSD)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-primary/5">
                    <span className="font-semibold">You Receive</span>
                    <span className="font-bold text-primary">
                      {method === "bank"
                        ? `₦${netNGN.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                        : `${formatCurrency(netUSD)} USDT`}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">{method === "bank" ? "Bank" : "Network"}</span>
                    <span className="font-medium">{method === "bank" ? bankName : "BEP-20 (BSC)"}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">{method === "bank" ? "Account" : "Address"}</span>
                    <span className="font-mono font-medium">{method === "bank" ? maskBankAccount(accountNumber) : maskWalletAddress(walletAddress)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Status Flow</p>
                  <p>Submitted → Processing → Reviewing → Completed</p>
                </div>
              </div>
            )}
          </div>

          {/* Fixed footer */}
          {step !== "submitting" && step !== "confirm_pin" && (
            <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-border space-y-2">
              {step === "method" && (
                <Button variant="ghost" className="w-full h-10 text-muted-foreground" onClick={() => { handleReset(); onClose(); }}>
                  Cancel
                </Button>
              )}
              {step === "phone" && phoneSubStep === "number" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleRequestClose}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSendSMS} disabled={sendingSMS || phoneNumber.length < 5}>
                    {sendingSMS ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Send Code
                  </Button>
                </div>
              )}
              {step === "phone" && phoneSubStep === "code" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setPhoneSubStep("number"); setSmsCode(""); }}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back
                  </Button>
                  <Button className="flex-1" onClick={handleVerifyPhone} disabled={smsCode.length !== 6}>
                    Verify & Continue
                  </Button>
                </div>
              )}
              {step === "bank_setup" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleRequestClose}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveBankDetails}>Save & Continue</Button>
                </div>
              )}
              {step === "wallet_setup" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleRequestClose}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveWallet}>Save & Continue</Button>
                </div>
              )}
              {step === "pin_setup" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleRequestClose}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSavePin} disabled={newPin.length !== 4 || confirmPin.length !== 4}>
                    Create PIN & Continue
                  </Button>
                </div>
              )}
              {step === "form" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleRequestClose}>Cancel</Button>
                  <Button className="flex-1 h-11" onClick={handleSubmitForm} disabled={!amount || parsedUSD <= 0}>
                    Review & Confirm
                  </Button>
                </div>
              )}
              {step === "success" && (
                <Button className="w-full h-11" onClick={() => { handleReset(); onClose(); }}>Done</Button>
              )}
            </div>
          )}
          {step === "confirm_pin" && (
            <div className="flex-shrink-0 px-5 pb-4 pt-2 border-t border-border">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("form"); setEnteredPin(""); setPinConfirmError(""); }}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back
                </Button>
                <Button
                  className="flex-1 h-11"
                  onClick={handleConfirmPin}
                  disabled={enteredPin.length !== 4}
                >
                  Confirm Withdrawal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Exit confirmation dialog */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Withdrawal?</DialogTitle>
            <DialogDescription>
              Your progress will be saved. You can resume from where you left off.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>
              Continue
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleForceClose}>
              Exit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
