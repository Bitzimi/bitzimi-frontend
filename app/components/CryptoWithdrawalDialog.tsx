import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ShieldCheck, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { depositMonitoringService } from "../services/depositMonitoringService";
import { userProfileService } from "../services/userProfileService";
import { SecurityPINDialog } from "./SecurityPINDialog";

const FEE_AMOUNT = 0.5; // Fixed $0.5 fee

interface CryptoWithdrawalDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userBalance: number;
  formatCurrency: (amount: number) => string;
  onBalanceDeduct: (amount: number) => void;
  onWithdrawalInitiated: (withdrawalId: string, amount: number, address: string) => void;
}

export function CryptoWithdrawalDialog({
  open,
  onClose,
  userId,
  userBalance,
  formatCurrency,
  onBalanceDeduct,
  onWithdrawalInitiated,
}: CryptoWithdrawalDialogProps) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [walletAddressConfigured, setWalletAddressConfigured] = useState(false);
  const [showPhoneRequiredDialog, setShowPhoneRequiredDialog] = useState(false);
  const [showWalletRequiredDialog, setShowWalletRequiredDialog] = useState(false);
  const [showPINRequiredDialog, setShowPINRequiredDialog] = useState(false);

  const parsed = parseFloat(amount) || 0;
  const fee = FEE_AMOUNT;
  const netAmount = parseFloat((parsed - fee).toFixed(2));

  // Check phone verification, wallet address, and existing pending withdrawal on mount
  useEffect(() => {
    if (!open) return;

    const profile = userProfileService.getProfile();
    setPhoneVerified(profile?.phoneVerified || false);

    const savedAddress = localStorage.getItem("bitzimiUSDTAddress");
    setWalletAddressConfigured(!!savedAddress);
    if (savedAddress) {
      setAddress(savedAddress);
    }

    // Check for existing pending withdrawal
    // IMPORTANT: Only ONE active pending withdrawal allowed at a time
    const activeWithdrawal = depositMonitoringService.getActiveWithdrawal(userId);
    if (activeWithdrawal && activeWithdrawal.method === "crypto") {
      console.log("📦 User has pending crypto withdrawal:", activeWithdrawal.id);
      // Show submitted state directly
      setAmount(activeWithdrawal.amount.toString());
      setSubmitted(true);
    } else {
      setSubmitted(false);
      setAmount("");
    }
  }, [open, userId]);

  const handleClose = () => {
    setAmount("");
    setAddress("");
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = () => {
    // Check phone verification
    if (!phoneVerified) {
      setShowPhoneRequiredDialog(true);
      return;
    }

    // Check wallet address
    if (!walletAddressConfigured || !address.trim()) {
      setShowWalletRequiredDialog(true);
      return;
    }

    // Validate amount
    if (!amount || parsed <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (parsed < 10) {
      toast.error("Minimum crypto withdrawal is $10");
      return;
    }
    if (parsed > userBalance) {
      toast.error("Insufficient balance");
      return;
    }

    // Check if PIN is set
    const savedPIN = localStorage.getItem("bitzimiSecurityPIN");
    if (!savedPIN) {
      setShowPINRequiredDialog(true);
      return;
    }

    // Show PIN dialog for verification
    setShowPINDialog(true);
  };

  const handlePINSuccess = () => {
    setShowPINDialog(false);

    // IMPORTANT: Create withdrawal session IMMEDIATELY
    // This creates persistent session in depositMonitoringService (localStorage)
    const withdrawal = depositMonitoringService.createWithdrawal(userId, "crypto", parsed, address.trim());

    console.log("✅ Created crypto withdrawal session:", {
      id: withdrawal.id,
      amount: parsed,
      fee: FEE_AMOUNT,
      netAmount: withdrawal.netAmount,
      destination: address.trim()
    });

    // Deduct balance immediately
    onBalanceDeduct(parsed);

    // Notify parent to create transaction history record with PENDING status
    onWithdrawalInitiated(withdrawal.id, parsed, address.trim());

    setSubmitted(true);
    toast.success("Withdrawal submitted — processing within 5-30 minutes.");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Crypto Withdrawal (USDT BEP-20)
          </DialogTitle>
          <DialogDescription>
            Withdraw to your USDT BEP-20 wallet. Estimated processing: 5-30 minutes.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex justify-between px-4 py-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-yellow-500">Processing</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span className="font-medium">{formatCurrency(parsed)}</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-medium text-red-500">-{formatCurrency(fee)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-primary/5">
                <span className="font-semibold">You Receive</span>
                <span className="font-bold text-primary">{formatCurrency(netAmount)} USDT</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-muted-foreground text-xs">Network</span>
                <span className="font-medium text-xs">BEP-20 (BSC)</span>
              </div>
            </div>

            <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Status Flow</p>
              <p>Submitted → Processing → Reviewing → Completed</p>
              <p className="pt-1">You will receive a notification when your withdrawal is completed.</p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-muted px-4 py-2.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Available Balance</span>
              <span className="font-semibold">{formatCurrency(userBalance)}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cw-amount">Withdrawal Amount (USD)</Label>
              <Input
                id="cw-amount"
                type="number"
                min="10"
                max={userBalance}
                placeholder="e.g. 50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {parsed > 0 && (
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="text-red-500">-{formatCurrency(fee)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 bg-primary/5">
                  <span className="font-semibold">You Receive</span>
                  <span className="font-bold text-primary">{formatCurrency(netAmount)} USDT</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cw-address">USDT BEP-20 (BSC) Wallet Address</Label>
              <Input
                id="cw-address"
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={walletAddressConfigured}
                className={walletAddressConfigured ? "bg-muted" : ""}
              />
              {walletAddressConfigured && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Wallet address from settings (auto-filled)
                </p>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Withdrawal Requirements
              </p>
              <p>• Minimum withdrawal: $10</p>
              <p>• Fixed network fee: {formatCurrency(FEE_AMOUNT)}</p>
              <p>• Network: BEP-20 (Binance Smart Chain) only</p>
              <p>• Processing time: 5-30 minutes</p>
              <p>• Security PIN required for confirmation</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit}>Submit Withdrawal</Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Security PIN Dialog */}
      <SecurityPINDialog
        open={showPINDialog}
        onClose={() => setShowPINDialog(false)}
        onSuccess={handlePINSuccess}
        title="Confirm Withdrawal"
        description="Enter your 4-digit security PIN to confirm this crypto withdrawal"
      />

      {/* Phone Verification Required Dialog */}
      <Dialog open={showPhoneRequiredDialog} onOpenChange={setShowPhoneRequiredDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Phone Verification Required
            </DialogTitle>
            <DialogDescription>
              You must verify your phone number before you can withdraw funds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-4">
              <p className="text-sm text-muted-foreground">
                Please go to your Profile page and verify your phone number to enable withdrawals.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPhoneRequiredDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowPhoneRequiredDialog(false);
                  handleClose();
                  navigate("/profile");
                }}
                className="flex-1"
              >
                Go to Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet Address Required Dialog */}
      <Dialog open={showWalletRequiredDialog} onOpenChange={setShowWalletRequiredDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              Wallet Address Required
            </DialogTitle>
            <DialogDescription>
              You must set up your USDT BEP-20 wallet address in Settings before withdrawing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4">
              <p className="text-sm text-muted-foreground">
                Please go to Settings and configure your USDT (BEP-20) withdrawal wallet address.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWalletRequiredDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowWalletRequiredDialog(false);
                  handleClose();
                  navigate("/settings");
                }}
                className="flex-1"
              >
                Go to Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Setup Required Dialog */}
      <Dialog open={showPINRequiredDialog} onOpenChange={setShowPINRequiredDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Security PIN Required
            </DialogTitle>
            <DialogDescription>
              You must set up a security PIN in Settings before withdrawing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4">
              <p className="text-sm text-muted-foreground">
                For your security, please set up a 4-digit withdrawal PIN in Settings first.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPINRequiredDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowPINRequiredDialog(false);
                  handleClose();
                  navigate("/settings");
                }}
                className="flex-1"
              >
                Go to Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
