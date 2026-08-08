/**
 * PhoneVerificationDialog — standalone phone verification modal.
 * Binance-style: tappable country card with flag, searchable dropdown list.
 * Responsive, no horizontal overflow, mobile-optimized.
 */
import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Loader2, Search, ChevronDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_COUNTRIES, getCountryByCode } from "../constants/countries";
import { userProfileService } from "../services/userProfileService";
import { phoneVerificationService } from "../services/phoneVerificationService";
import { useGeoLocation } from "../hooks/useGeoLocation";
import { useNotifications } from "../contexts/NotificationContext";
import { dispatchIdentityUpdate } from "../contexts/IdentityContext";

interface PhoneVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the phone number is successfully verified */
  onVerified: () => void;
}

export function PhoneVerificationDialog({
  open, onClose, onVerified,
}: PhoneVerificationDialogProps) {
  const geo = useGeoLocation();
  const { addNotification } = useNotifications();
  const searchRef = useRef<HTMLInputElement>(null);

  const [selectedCode, setSelectedCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [actualCode, setActualCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  // Country picker
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Auto-select country from IP on open
  useEffect(() => {
    if (!open) return;
    setPhone(""); setShowCodeInput(false); setVerificationCode("");
    setShowCountryPicker(false); setCountrySearch("");
    if (!geo.loading && geo.countryCode) {
      const c = getCountryByCode(geo.countryCode);
      if (c) setSelectedCode(c.phoneCode);
    }
  }, [open, geo.loading, geo.countryCode]);

  // Focus search when picker opens
  useEffect(() => {
    if (showCountryPicker) {
      setCountrySearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [showCountryPicker]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const selectedCountry = SUPPORTED_COUNTRIES.find(c => c.phoneCode === selectedCode);

  const filteredCountries = countrySearch.trim()
    ? SUPPORTED_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.phoneCode.includes(countrySearch) ||
        c.code.toLowerCase().startsWith(countrySearch.toLowerCase())
      )
    : SUPPORTED_COUNTRIES;

  const handleGetCode = () => {
    if (!phone || phone.trim().length < 5) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSending(true);
    const full = `${selectedCode}${phone.trim()}`;
    const result = phoneVerificationService.sendVerificationCode(full);
    setSending(false);
    if (result.success) {
      toast.success("Verification code sent");
      setShowCodeInput(true);
      setCountdown(300);
      setActualCode(result.code ?? "");
      console.log("📱 Code:", result.code, "| Phone:", full);
    } else {
      toast.error(result.message);
    }
  };

  const handleConfirm = () => {
    const result = phoneVerificationService.verifyCode(verificationCode);
    if (!result.success) { toast.error(result.message); return; }

    const updateResult = userProfileService.updatePhone(selectedCode, phone);
    if (!updateResult.success) { toast.error(updateResult.message); return; }

    const country = SUPPORTED_COUNTRIES.find(c => c.phoneCode === selectedCode);
    userProfileService.verifyPhone(country?.code ?? "", country?.name ?? "");
    dispatchIdentityUpdate();

    addNotification("success", "Phone Number Verified",
      `${selectedCode} ${phone} has been verified.`,
      { type: "phone_verification" }
    );
    toast.success("Phone number verified!");
    onClose();
    onVerified();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { onClose(); setShowCodeInput(false); setVerificationCode(""); setShowCountryPicker(false); }
      }}
    >
      <DialogContent className="sm:max-w-sm max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <DialogHeader>
            <DialogTitle>Verify Phone Number</DialogTitle>
            <DialogDescription>
              A verified number is required to enable withdrawals.
              {geo.country && !geo.loading && (
                <span className="block mt-0.5 text-xs text-primary/80">
                  Detected: {geo.country}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!showCountryPicker ? (
            <>
              {!showCodeInput && (
                <div className="space-y-2">
                  <Label>Phone Number</Label>

                  {/* Country selector button — Binance-style card */}
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(true)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-input bg-muted/30 hover:bg-muted/60 active:bg-muted transition-colors text-left"
                  >
                    <span className="text-2xl shrink-0 leading-none">{selectedCountry?.flag ?? "🌐"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">
                        {selectedCountry?.name ?? "Select Country"}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedCode}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>

                  {/* Phone number input row */}
                  <div className="flex h-12 rounded-xl border border-input overflow-hidden focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary transition-all">
                    <div className="flex items-center px-3 bg-muted border-r border-input shrink-0">
                      <span className="text-sm font-mono font-semibold text-foreground select-none">
                        {selectedCode}
                      </span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder={selectedCountry?.placeholder ?? "Phone number"}
                      className="flex-1 h-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60"
                      onKeyDown={e => e.key === "Enter" && handleGetCode()}
                    />
                  </div>

                  {selectedCountry?.digits && (
                    <p className="text-xs text-muted-foreground">
                      {selectedCountry.digits} digits required
                    </p>
                  )}
                </div>
              )}

              {showCodeInput && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4">
                    <p className="text-xs font-medium text-foreground mb-2">
                      Code sent to {selectedCode} {phone}
                    </p>
                    <div className="bg-background rounded-lg p-3 text-center font-mono text-2xl font-bold tracking-[0.4em] text-primary">
                      {actualCode}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Enter 6-digit code</Label>
                    <Input
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      maxLength={6}
                      className="h-12 text-center tracking-[0.5em] text-xl font-mono"
                      autoFocus
                      onKeyDown={e => e.key === "Enter" && verificationCode.length === 6 && handleConfirm()}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Country picker panel */
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search country or dial code…"
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-input bg-muted/30 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                />
              </div>

              {/* Country list */}
              <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-1 px-1">
                {filteredCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No results for "{countrySearch}"
                  </p>
                ) : (
                  filteredCountries.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setSelectedCode(c.phoneCode);
                        setPhone("");
                        setShowCountryPicker(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        c.phoneCode === selectedCode
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/60 active:bg-muted"
                      }`}
                    >
                      <span className="text-xl w-8 text-center shrink-0 leading-none">{c.flag}</span>
                      <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                      <span className="text-sm font-mono text-muted-foreground shrink-0">{c.phoneCode}</span>
                      {c.phoneCode === selectedCode && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-border">
          {showCountryPicker ? (
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => { setShowCountryPicker(false); setCountrySearch(""); }}
            >
              Back
            </Button>
          ) : !showCodeInput ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={onClose}>Cancel</Button>
              <Button
                className="flex-1 h-11"
                onClick={handleGetCode}
                disabled={sending || phone.length < 5}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Code
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => { setShowCodeInput(false); setVerificationCode(""); }}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={handleConfirm}
                disabled={verificationCode.length !== 6}
              >
                Verify & Continue
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
