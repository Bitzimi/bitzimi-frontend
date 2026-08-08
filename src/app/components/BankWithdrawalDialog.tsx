import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ShieldCheck, Info, Building2, Lock, CheckCircle2, Phone } from "lucide-react";
import { toast } from "sonner";
import { depositMonitoringService } from "../services/depositMonitoringService";
import { userProfileService } from "../services/userProfileService";
import { SecurityPINDialog } from "./SecurityPINDialog";
import { PhoneVerificationDialog } from "./PhoneVerificationDialog";

const FEE_AMOUNT_NGN = 1500;
const NGN_TO_USD_RATE = 1347;
const MIN_WITHDRAWAL_USD = 10;
const MIN_WITHDRAWAL_NGN = MIN_WITHDRAWAL_USD * NGN_TO_USD_RATE;

function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return "••••";
  return acc.slice(0, 2) + "••••" + acc.slice(-4);
}

type FlowStep = "phone" | "bank_setup" | "pin_setup" | "form" | "submitted";

interface BankWithdrawalDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userBalance: number;
  formatCurrency: (amount: number) => string;
  onBalanceDeduct: (amount: number) => void;
  onWithdrawalInitiated: (withdrawalId: string, amountUSD: number, amountNGN: number, bankDetails: { bankName: string; accountName: string; accountNumber: string }) => void;
}

export function BankWithdrawalDialog({
  open,
  onClose,
  userId,
  userBalance,
  formatCurrency,
  onBalanceDeduct,
  onWithdrawalInitiated,
}: BankWithdrawalDialogProps) {
  const [step, setStep] = useState<FlowStep>("form");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankDetailsConfigured, setBankDetailsConfigured] = useState(false);
  const [withdrawalRef, setWithdrawalRef] = useState("");
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);

  // Inline PIN setup state
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");

  const parsedUSD = parseFloat(amount) || 0;
  const parsedNGN = parsedUSD * NGN_TO_USD_RATE;
  const feeNGN = FEE_AMOUNT_NGN;
  const netAmountNGN = parsedNGN - feeNGN;

  useEffect(() => {
    if (!open) return;
    checkAndSetStep();
  }, [open, userId]);

  const checkAndSetStep = () => {
    const profile = userProfileService.getProfile();
    const phoneVerified = profile?.phoneVerified || false;

    if (!phoneVerified) {
      setStep("phone");
      return;
    }

    const stored = localStorage.getItem("bitzimiBankDetails");
    if (stored) {
      try {
        const details = JSON.parse(stored);
        setBankDetailsConfigured(true);
        setAccountName(details.accountName || "");
        setAccountNumber(details.accountNumber || "");
        setBankName(details.bankName || "");
      } catch {
        setBankDetailsConfigured(false);
        setStep("bank_setup");
        return;
      }
    } else {
      setBankDetailsConfigured(false);
      setStep("bank_setup");
      return;
    }

    const savedPIN = localStorage.getItem("bitzimiSecurityPIN");
    if (!savedPIN) {
      setStep("pin_setup");
      return;
    }

    const activeWithdrawal = depositMonitoringService.getActiveWithdrawal(userId);
    if (activeWithdrawal && activeWithdrawal.method === "bank") {
      setAmount(activeWithdrawal.amount.toString());
      setWithdrawalRef(activeWithdrawal.id.slice(-8).toUpperCase());
      setStep("submitted");
      return;
    }

    setAmount("");
    setWithdrawalRef("");
    setStep("form");
  };

  const handleClose = () => {
    setAmount("");
    setNewPin("");
    setConfirmPin("");
    setPinError("");
    if (!bankDetailsConfigured) {
      setAccountName("");
      setAccountNumber("");
      setBankName("");
    }
    setWithdrawalRef("");
    onClose();
  };

  const handleSaveBankDetails = () => {
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      toast.error("Please fill in all bank details");
      return;
    }
    if (accountNumber.replace(/\D/g, "").length < 8) {
      toast.error("Please enter a valid account number (min. 8 digits)");
      return;
    }
    const details = {
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
    };
    localStorage.setItem("bitzimiBankDetails", JSON.stringify(details));
    localStorage.setItem("bitzimiBankSavedAt", new Date().toISOString());
    setBankDetailsConfigured(true);
    window.dispatchEvent(new CustomEvent("identity-updated"));
    toast.success("Bank details saved");
    const savedPIN = localStorage.getItem("bitzimiSecurityPIN");
    setStep(savedPIN ? "form" : "pin_setup");
  };

  const WEAK_PINS = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999","1234","4321","0123","9876","2345","3456","4567","5678","6789"];

  const handleSavePIN = () => {
    setPinError("");
    if (newPin.length !== 4) { setPinError("PIN must be exactly 4 digits"); return; }
    if (!/^\d{4}$/.test(newPin)) { setPinError("PIN must contain only digits"); return; }
    if (newPin !== confirmPin) { setPinError("PINs do not match"); return; }
    if (WEAK_PINS.includes(newPin)) { setPinError("PIN is too predictable. Choose a different combination."); return; }
    localStorage.setItem("bitzimiSecurityPIN", newPin);
    toast.success("Security PIN created");
    setNewPin("");
    setConfirmPin("");
    setStep("form");
  };

  const handleSubmit = () => {
    if (!amount || parsedUSD <= 0) { toast.error("Please enter a valid amount"); return; }
    if (parsedUSD < MIN_WITHDRAWAL_USD) {
      toast.error(`Minimum withdrawal is $${MIN_WITHDRAWAL_USD}`);
      return;
    }
    if (parsedUSD > userBalance) { toast.error("Insufficient balance"); return; }
    setShowPINDialog(true);
  };

  const handlePINSuccess = () => {
    setShowPINDialog(false);
    const destination = `${bankName} | ${accountName} | ${accountNumber}`;
    const withdrawal = depositMonitoringService.createWithdrawal(userId, "bank", parsedUSD, destination);
    setWithdrawalRef(withdrawal.id.slice(-8).toUpperCase());
    onBalanceDeduct(parsedUSD);
    onWithdrawalInitiated(withdrawal.id, parsedUSD, parsedNGN, { bankName, accountName, accountNumber });
    setStep("submitted");
    toast.success("Withdrawal submitted — usually completed within 1 hour.");
  };

  const setupSteps: FlowStep[] = ["phone", "bank_setup", "pin_setup"];
  const setupIdx = setupSteps.indexOf(step);
  const isSetupStep = setupIdx >= 0;

  const stepTitles: Record<FlowStep, { title: string; description: string }> = {
    phone: { title: "Verify Phone Number", description: "Phone verification is required before withdrawals." },
    bank_setup: { title: "Set Up Bank Account", description: "Add your bank account details to enable withdrawals." },
    pin_setup: { title: "Create Security PIN", description: "Set a 4-digit PIN to secure your withdrawals." },
    form: { title: "Bank Withdrawal", description: "Withdraw funds to your registered bank account." },
    submitted: { title: "Withdrawal Submitted", description: "Your request is being processed." },
  };

  const meta = stepTitles[step];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Fixed header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {meta.title}
            </DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </DialogHeader>
          {isSetupStep && (
            <div className="flex items-center gap-1.5 mt-3">
              {setupSteps.map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < setupIdx ? "bg-primary" : i === setupIdx ? "bg-primary/60" : "bg-muted"
                }`} />
              ))}
              <span className="text-[11px] text-muted-foreground ml-1.5 shrink-0">Step {setupIdx + 1}/3</span>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Phone verification step */}
          {step === "phone" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-orange-500/8 border border-orange-500/20 p-4 flex items-start gap-3">
                <Phone className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Phone Verification Required</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Verify your phone number to unlock withdrawals and secure your account.
                  </p>
                </div>
              </div>
              <Button className="w-full h-11" onClick={() => setShowPhoneVerify(true)}>
                <Phone className="h-4 w-4 mr-2" />
                Verify Phone Number
              </Button>
            </div>
          )}

          {/* Bank account setup step */}
          {step === "bank_setup" && (
            <>
              <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-3.5 flex items-start gap-3">
                <Building2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your bank details are saved locally and will be used for all future withdrawals.
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
                  placeholder="Account number"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  className="h-11 font-mono tracking-widest"
                  inputMode="numeric"
                />
              </div>
            </>
          )}

          {/* PIN setup step */}
          {step === "pin_setup" && (
            <>
              <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3.5 flex items-start gap-3">
                <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your 4-digit PIN is required for every withdrawal. Store it somewhere safe.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>New 4-Digit PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={newPin}
                  onChange={e => { setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
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
                  onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
                  className="h-11 text-center font-mono tracking-[0.5em] text-lg"
                />
              </div>
              {pinError && <p className="text-xs text-red-500">{pinError}</p>}
            </>
          )}

          {/* Withdrawal form step */}
          {step === "form" && (
            <>
              <div className="rounded-xl bg-muted px-4 py-2.5 flex justify-between text-sm">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-semibold">{formatCurrency(userBalance)}</span>
              </div>

              {/* Destination account card */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Destination Account</span>
                </div>
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
                    <span className="font-mono font-medium">{maskAccountNumber(accountNumber)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Withdrawal Amount (USD)</Label>
                <Input
                  type="number"
                  min={MIN_WITHDRAWAL_USD}
                  step="0.01"
                  max={userBalance}
                  placeholder={`Min. $${MIN_WITHDRAWAL_USD}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: ${MIN_WITHDRAWAL_USD} (₦{MIN_WITHDRAWAL_NGN.toLocaleString()})
                </p>
              </div>

              {parsedUSD > 0 && (
                <div className="rounded-xl border border-border divide-y text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Amount in Local Currency</span>
                    <span className="font-semibold">₦{parsedNGN.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Processing Fee</span>
                    <span className="text-red-500">−₦{feeNGN.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-primary/5">
                    <span className="font-semibold">You Receive</span>
                    <span className="font-bold text-primary">₦{Math.max(0, netAmountNGN).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-xs">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span className="text-muted-foreground">₦{NGN_TO_USD_RATE.toLocaleString()} = $1</span>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />Withdrawal Info
                </p>
                <p>• Processing time: Usually within 1 hour</p>
                <p>• Fixed processing fee: ₦{FEE_AMOUNT_NGN.toLocaleString()}</p>
                <p>• Security PIN required to confirm</p>
              </div>
            </>
          )}

          {/* Submitted / success step */}
          {step === "submitted" && (
            <>
              <div className="flex flex-col items-center py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold text-lg">Withdrawal Submitted</h3>
                <p className="text-sm text-muted-foreground mt-1">usually completed within 1 hour.</p>
              </div>

              <div className="rounded-xl border border-border divide-y text-sm">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-semibold text-yellow-500">Processing</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-medium">{withdrawalRef}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Amount Requested</span>
                  <span className="font-medium">{formatCurrency(parsedUSD)}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Processing Fee</span>
                  <span className="text-red-500">−₦{feeNGN.toLocaleString()}</span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-primary/5">
                  <span className="font-semibold">You Receive</span>
                  <span className="font-bold text-primary">₦{Math.max(0, netAmountNGN).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-medium text-right">{bankName} — {maskAccountNumber(accountNumber)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Status Flow</p>
                <p>Submitted → Processing → Reviewing → Completed</p>
              </div>
            </>
          )}
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-border">
          {step === "phone" && (
            <Button variant="outline" className="w-full" onClick={handleClose}>Cancel</Button>
          )}
          {step === "bank_setup" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
                <Button className="flex-1" onClick={handleSaveBankDetails}>Save & Continue</Button>
              </div>
            )}
            {step === "pin_setup" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
                <Button className="flex-1" onClick={handleSavePIN} disabled={newPin.length !== 4 || confirmPin.length !== 4}>
                  Create PIN & Continue
                </Button>
              </div>
            )}
            {step === "form" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={!amount || parsedUSD <= 0}>
                  Submit Withdrawal
                </Button>
              </div>
            )}
            {step === "submitted" && (
            <Button className="w-full" onClick={handleClose}>Done</Button>
          )}
        </div>
      </DialogContent>

      <SecurityPINDialog
        open={showPINDialog}
        onClose={() => setShowPINDialog(false)}
        onSuccess={handlePINSuccess}
        title="Confirm Withdrawal"
        description="Enter your 4-digit security PIN to authorize this withdrawal"
      />

      <PhoneVerificationDialog
        open={showPhoneVerify}
        onClose={() => setShowPhoneVerify(false)}
        onVerified={() => {
          setShowPhoneVerify(false);
          const stored = localStorage.getItem("bitzimiBankDetails");
          if (!stored) { setStep("bank_setup"); return; }
          try { JSON.parse(stored); } catch { setStep("bank_setup"); return; }
          const savedPIN = localStorage.getItem("bitzimiSecurityPIN");
          setStep(savedPIN ? "form" : "pin_setup");
        }}
      />
    </Dialog>
  );
}
