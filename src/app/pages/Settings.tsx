import { useState, useEffect, useCallback } from "react";

// ── Backend API helper ────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function apiFetch(path: string, options?: RequestInit) {
  if (!API_BASE || !getToken()) throw new Error("No backend connection");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((json as any)?.error?.message ?? "API error"), { code: (json as any)?.error?.code });
  return json;
}
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useSettings, CURRENCIES } from "../contexts/SettingsContext";
import {
  Globe,
  DollarSign,
  Moon,
  Sun,
  Lock,
  Key,
  Shield,
  CreditCard,
  Building2,
  CheckCircle2,
  Edit,
  EyeOff,
  Eye,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { userProfileService } from "../services/userProfileService";
import { SecurityPINDialog } from "../components/SecurityPINDialog";
import { useNotifications } from "../contexts/NotificationContext";
import { useIdentity } from "../contexts/IdentityContext";
import { useGeoLocation } from "../hooks/useGeoLocation";

// Weak PIN patterns to block
const WEAK_PINS = [
  "0000","1111","2222","3333","4444","5555","6666","7777","8888","9999",
  "1234","4321","0123","9876","2345","3456","4567","5678","6789",
];
function isWeakPin(p: string): boolean {
  if (WEAK_PINS.includes(p)) return true;
  // all same digit
  if (/^(.)\1{3}$/.test(p)) return true;
  return false;
}

function maskAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
function maskAccount(acc: string): string {
  if (!acc || acc.length < 4) return "••••";
  return `••••••${acc.slice(-4)}`;
}

export default function Settings() {
  const { theme, setTheme, currency, setCurrency, language, setLanguage, availableLanguages } = useSettings();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();
  const geo = useGeoLocation();

  // ─── PIN state ────────────────────────────────────────────────
  const [isPinSet, setIsPinSet] = useState(false);
  const [showCreatePinModal, setShowCreatePinModal] = useState(false);
  const [showEditPinModal, setShowEditPinModal] = useState(false);
  const [pinForm, setPinForm] = useState({ newPin: "", confirmPin: "", currentPin: "" });
  const [savingPin, setSavingPin] = useState(false);

  // ─── Password state ───────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPwFields, setShowPwFields] = useState({ current: false, newPw: false, confirm: false });

  // ─── USDT wallet state ────────────────────────────────────────
  const [usdtAddress, setUsdtAddress] = useState("");
  const [usdtDisplayMode, setUsdtDisplayMode] = useState(false);
  const [usdtSavedAt, setUsdtSavedAt] = useState<string | null>(null);
  const [usdtInputValue, setUsdtInputValue] = useState("");
  const [savingUsdt, setSavingUsdt] = useState(false);
  const [showPINForWallet, setShowPINForWallet] = useState(false);
  const [pendingWalletAddress, setPendingWalletAddress] = useState<string | null>(null);

  // ─── Bank details state ───────────────────────────────────────
  const [bankDetails, setBankDetails] = useState({ accountName: "", accountNumber: "", bankName: "" });
  const [bankDisplayMode, setBankDisplayMode] = useState(false);
  const [bankSavedAt, setBankSavedAt] = useState<string | null>(null);
  const [bankInputValue, setBankInputValue] = useState({ accountName: "", accountNumber: "", bankName: "" });
  const [savingBank, setSavingBank] = useState(false);
  const [showPINForBank, setShowPINForBank] = useState(false);
  const [pendingBankDetails, setPendingBankDetails] = useState<typeof bankDetails | null>(null);

  // ─── 2FA state ────────────────────────────────────────────────
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAEnabledAt, setTwoFAEnabledAt] = useState<string | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(false);

  // ─── On mount: load persisted data from backend ──────────────
  const loadBackendData = useCallback(async () => {
    try {
      const payJson = await apiFetch("/api/v1/users/me/payment");
      const pay = payJson?.data;
      if (pay?.hasPIN !== undefined) setIsPinSet(!!pay.hasPIN);
      if (pay?.usdtAddress) {
        setUsdtAddress(pay.usdtAddress);
        setUsdtInputValue(pay.usdtAddress);
        setUsdtDisplayMode(true);
        setUsdtSavedAt(new Date().toISOString()); // server doesn't return saved-at yet
      }
      if (pay?.bankAccountName) {
        const bd = { accountName: pay.bankAccountName, accountNumber: pay.bankAccountNumber ?? "", bankName: pay.bankName ?? "" };
        setBankDetails(bd);
        setBankInputValue(bd);
        setBankDisplayMode(true);
        setBankSavedAt(new Date().toISOString());
      }
    } catch { /* backend unavailable — no data */ }

    try {
      const twoFAJson = await apiFetch("/api/v1/users/me/2fa");
      if (twoFAJson?.data?.enabled) { setTwoFAEnabled(true); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadBackendData(); }, [loadBackendData]);

  // Nigerian detection — IP geolocation only. Currency NEVER determines region.
  const isNigerian = (): boolean => {
    // Priority 1: Live IP geolocation (reflects current location/VPN)
    if (!geo.loading && geo.countryCode === "NG") return true;
    // Priority 2: Verified phone country ISO (e.g. after phone verification in Nigeria)
    const profile = userProfileService.getProfile();
    if (profile?.phoneVerified && profile.phoneCountryIso === "NG") return true;
    // Fallback: legacy +234 phone code
    if (profile?.phoneVerified && profile.phoneCountryCode === "+234") return true;
    return false;
  };

  // ─── PIN handlers (backend via POST /api/v1/users/me/security-pin) ──────────
  const handleCreatePin = async () => {
    const { newPin, confirmPin } = pinForm;
    if (!newPin || newPin.length !== 4) { toast.error("PIN must be exactly 4 digits"); return; }
    if (!/^\d{4}$/.test(newPin)) { toast.error("PIN must contain only digits"); return; }
    if (isWeakPin(newPin)) { toast.error("PIN is too simple. Avoid sequences like 1234 or 0000"); return; }
    if (newPin !== confirmPin) { toast.error("PINs do not match"); return; }
    setSavingPin(true);
    try {
      await apiFetch("/api/v1/users/me/security-pin", { method: "POST", body: JSON.stringify({ pin: newPin }) });
      setIsPinSet(true);
      setShowCreatePinModal(false);
      setPinForm({ newPin: "", confirmPin: "", currentPin: "" });
      toast.success("Security PIN created successfully");
      addNotification("security", "Security PIN Created", "Your 4-digit security PIN has been set", { type: "pin_set" });
    } catch (err: any) { toast.error(err.message ?? "Failed to create PIN"); }
    finally { setSavingPin(false); }
  };

  const handleEditPin = async () => {
    const { currentPin, newPin, confirmPin } = pinForm;
    if (!newPin || newPin.length !== 4) { toast.error("New PIN must be exactly 4 digits"); return; }
    if (!/^\d{4}$/.test(newPin)) { toast.error("PIN must contain only digits"); return; }
    if (isWeakPin(newPin)) { toast.error("PIN is too simple. Avoid sequences like 1234 or 0000"); return; }
    if (newPin === currentPin) { toast.error("New PIN must differ from current PIN"); return; }
    if (newPin !== confirmPin) { toast.error("New PINs do not match"); return; }
    // Verify current PIN on backend first
    setSavingPin(true);
    try {
      await apiFetch("/api/v1/users/me/security-pin/verify", { method: "POST", body: JSON.stringify({ pin: currentPin }) });
      await apiFetch("/api/v1/users/me/security-pin", { method: "POST", body: JSON.stringify({ pin: newPin }) });
      setShowEditPinModal(false);
      setPinForm({ newPin: "", confirmPin: "", currentPin: "" });
      toast.success("Security PIN updated successfully");
      addNotification("security", "Security PIN Updated", "Your security PIN has been changed", { type: "pin_change" });
    } catch (err: any) {
      if ((err as any).code === "INCORRECT_PIN") toast.error("Current PIN is incorrect");
      else toast.error(err.message ?? "Failed to update PIN");
    }
    finally { setSavingPin(false); }
  };

  // ─── Password handler (backend via POST /api/v1/users/me/change-password) ────
  const handlePasswordChange = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      toast.error("Please fill all password fields"); return;
    }
    if (pwForm.newPw !== pwForm.confirm) { toast.error("New passwords do not match"); return; }
    if (pwForm.newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setPasswordLoading(true);
    try {
      await apiFetch("/api/v1/users/me/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      });
      setPwForm({ current: "", newPw: "", confirm: "" });
      setShowPasswordModal(false);
      toast.success("Password updated. All devices have been logged out for security.");
      addNotification("security", "Password Changed", "Your account password was changed successfully. All sessions revoked.", { type: "password_change" });
    } catch (err: any) {
      if ((err as any).code === "INCORRECT_PASSWORD") toast.error("Current password is incorrect");
      else toast.error(err.message ?? "Failed to change password");
    }
    finally { setPasswordLoading(false); }
  };

  // ─── USDT handlers ────────────────────────────────────────────
  const handleSaveUSDT = () => {
    if (!usdtInputValue || usdtInputValue.length < 20) {
      toast.error("Please enter a valid wallet address (min 20 characters)"); return;
    }
    if (!isPinSet) {
      toast.error("Create a Security PIN first before saving a wallet address");
      setShowCreatePinModal(true); return;
    }
    setPendingWalletAddress(usdtInputValue);
    setShowPINForWallet(true);
  };

  const handleWalletPINSuccess = async () => {
    if (!pendingWalletAddress) return;
    setSavingUsdt(true);
    try {
      await apiFetch("/api/v1/users/me/payment", {
        method: "PATCH",
        body: JSON.stringify({ usdtAddress: pendingWalletAddress }),
      });
      const now = new Date().toISOString();
      // Keep local mirrors for withdrawal components that still read localStorage
      localStorage.setItem("bitzimiUSDTAddress", pendingWalletAddress);
      localStorage.setItem("bitzimiUSDTSavedAt", now);
      setUsdtAddress(pendingWalletAddress);
      setUsdtSavedAt(now);
      setUsdtDisplayMode(true);
      setPendingWalletAddress(null);
      setShowPINForWallet(false);
      toast.success("USDT wallet address saved");
      addNotification("security", "Crypto Wallet Updated", `Your USDT BEP-20 wallet address has been saved`, { type: "wallet_update" });
    } catch (err: any) { toast.error(err.message ?? "Failed to save wallet address"); }
    finally { setSavingUsdt(false); }
  };

  // ─── Bank handlers (backend via PATCH /api/v1/users/me/payment) ──────────────
  const handleSaveBankDetails = () => {
    if (!bankInputValue.accountName || !bankInputValue.accountNumber || !bankInputValue.bankName) {
      toast.error("Please fill all bank details"); return;
    }
    if (!isPinSet) {
      toast.error("Create a Security PIN first before saving bank details");
      setShowCreatePinModal(true); return;
    }
    setPendingBankDetails(bankInputValue);
    setShowPINForBank(true);
  };

  const handleBankPINSuccess = async () => {
    if (!pendingBankDetails) return;
    setSavingBank(true);
    try {
      await apiFetch("/api/v1/users/me/payment", {
        method: "PATCH",
        body: JSON.stringify({
          bankAccountName:   pendingBankDetails.accountName,
          bankAccountNumber: pendingBankDetails.accountNumber,
          bankName:          pendingBankDetails.bankName,
        }),
      });
      const now = new Date().toISOString();
      // Keep local mirrors for withdrawal components
      localStorage.setItem("bitzimiBankDetails", JSON.stringify(pendingBankDetails));
      localStorage.setItem("bitzimiBankSavedAt", now);
      setBankDetails(pendingBankDetails);
      setBankSavedAt(now);
      setBankDisplayMode(true);
      setPendingBankDetails(null);
      setShowPINForBank(false);
      toast.success("Bank details saved");
      addNotification("security", "Bank Account Updated", `Your bank account (${pendingBankDetails.bankName}) has been saved`, { type: "bank_update" });
    } catch (err: any) { toast.error(err.message ?? "Failed to save bank details"); }
    finally { setSavingBank(false); }
  };

  // ─── 2FA handlers (backend TOTP via /api/v1/users/me/2fa/*) ──────────────────
  // Step 1: Setup — generate secret + QR
  const [twoFASetupData, setTwoFASetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [twoFASetupCode, setTwoFASetupCode] = useState("");
  const [showTwoFASetup, setShowTwoFASetup] = useState(false);
  const [twoFADisablePin, setTwoFADisablePin] = useState("");
  const [showTwoFADisable, setShowTwoFADisable] = useState(false);

  const handleEnable2FA = async () => {
    setTwoFALoading(true);
    try {
      const json = await apiFetch("/api/v1/users/me/2fa/setup", { method: "POST", body: "{}" });
      setTwoFASetupData(json.data);
      setShowTwoFASetup(true);
    } catch (err: any) { toast.error(err.message ?? "Failed to generate 2FA secret"); }
    finally { setTwoFALoading(false); }
  };

  const handleConfirmEnable2FA = async () => {
    if (!twoFASetupCode || twoFASetupCode.length !== 6) { toast.error("Enter the 6-digit code from your authenticator app"); return; }
    setTwoFALoading(true);
    try {
      await apiFetch("/api/v1/users/me/2fa/enable", { method: "POST", body: JSON.stringify({ token: twoFASetupCode }) });
      setTwoFAEnabled(true);
      setTwoFAEnabledAt(new Date().toISOString());
      setShowTwoFASetup(false);
      setTwoFASetupData(null);
      setTwoFASetupCode("");
      // Persist for Login.tsx backward-compat
      localStorage.setItem("bitzimi2FASettings", JSON.stringify({ enabled: true, enabledAt: new Date().toISOString() }));
      toast.success("Google Authenticator 2FA enabled");
      addNotification("security", "2FA Enabled", "Google Two-Factor Authentication is now active on your account", { type: "2fa_change" });
    } catch (err: any) {
      if ((err as any).code === "INVALID_2FA_CODE") toast.error("Invalid code — try again");
      else toast.error(err.message ?? "Failed to enable 2FA");
    }
    finally { setTwoFALoading(false); }
  };

  const handleDisable2FA = async () => {
    if (!twoFADisablePin || twoFADisablePin.length !== 4) { toast.error("Enter your 4-digit Security PIN to disable 2FA"); return; }
    setTwoFALoading(true);
    try {
      await apiFetch("/api/v1/users/me/2fa/disable", { method: "POST", body: JSON.stringify({ pin: twoFADisablePin }) });
      setTwoFAEnabled(false);
      setTwoFAEnabledAt(null);
      setShowTwoFADisable(false);
      setTwoFADisablePin("");
      localStorage.setItem("bitzimi2FASettings", JSON.stringify({ enabled: false, enabledAt: null }));
      localStorage.removeItem("bitzimi2FADeviceTrust");
      toast.success("Google 2FA disabled");
      addNotification("security", "2FA Disabled", "Google Two-Factor Authentication has been disabled", { type: "2fa_change" });
    } catch (err: any) {
      if ((err as any).code === "INCORRECT_PIN") toast.error("Incorrect PIN");
      else toast.error(err.message ?? "Failed to disable 2FA");
    }
    finally { setTwoFALoading(false); }
  };

  // Legacy toggle (kept for UI that uses single button)
  const handleToggle2FA = () => {
    if (twoFAEnabled) setShowTwoFADisable(true);
    else handleEnable2FA();
  };

  // ─── Preferences sync (backend via PATCH /api/v1/users/me/preferences) ────────
  const syncPreference = useCallback(async (pref: Record<string, string>) => {
    try { await apiFetch("/api/v1/users/me/preferences", { method: "PATCH", body: JSON.stringify(pref) }); }
    catch { /* non-fatal: local preference still works */ }
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <ResponsiveLayout>
      <div className="mb-6">
        <h2 className="text-lg md:text-2xl font-semibold mb-2">Settings</h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          Manage your account preferences and security
        </p>
      </div>

      {/* ── Currency ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency Preference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Display Currency</Label>
            <Select
              value={currency.code}
              onValueChange={(code) => {
                const c = CURRENCIES.find(x => x.code === code);
                if (c) { setCurrency(c); toast.success(`Display currency changed to ${code}`); syncPreference({ currencyPref: code }); }
              }}
            >
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Display only — no actual currency conversion is applied.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Theme ────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button variant={theme === "light" ? "default" : "outline"} className="flex-1 h-11"
              onClick={() => { setTheme("light"); toast.success("Light theme enabled"); syncPreference({ themePref: "light" }); }}>
              <Sun className="mr-2 h-4 w-4" />Light
            </Button>
            <Button variant={theme === "dark" ? "default" : "outline"} className="flex-1 h-11"
              onClick={() => { setTheme("dark"); toast.success("Dark theme enabled"); syncPreference({ themePref: "dark" }); }}>
              <Moon className="mr-2 h-4 w-4" />Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Language ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label>Select Language</Label>
            <Select
              value={language.code}
              onValueChange={(code) => {
                const l = availableLanguages.find(x => x.code === code);
                if (l) {
                  setLanguage(l);
                  toast.success(`Language changed to ${l.name}`);
                  syncPreference({ languagePref: code });
                }
              }}
            >
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableLanguages.map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Security PIN ─────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security PIN
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPinSet ? (
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Security PIN</p>
                  <p className="text-base font-mono tracking-[0.4em] text-gray-600 dark:text-gray-400">••••</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setPinForm({ newPin: "", confirmPin: "", currentPin: "" });
                setShowEditPinModal(true);
              }}>
                <Edit className="h-3.5 w-3.5 mr-1" />Edit PIN
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Security PIN</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Required for withdrawals and wallet changes</p>
              </div>
              <Badge variant="secondary" className="text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                Not Set
              </Badge>
            </div>
          )}
          {!isPinSet && (
            <Button className="w-full h-11 mt-4" onClick={() => {
              setPinForm({ newPin: "", confirmPin: "", currentPin: "" });
              setShowCreatePinModal(true);
            }}>
              <Lock className="h-4 w-4 mr-2" />Create Security PIN
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Change Password — collapsed by default, opens modal ─ */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update your account password to keep your account secure.
            </p>
            <Button size="sm"
              className="sm:ml-4 sm:flex-shrink-0 w-full sm:w-auto bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100"
              onClick={() => { setPwForm({ current: "", newPw: "", confirm: "" }); setShowPwFields({ current: false, newPw: false, confirm: false }); setShowPasswordModal(true); }}>
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password modal */}
      <Dialog open={showPasswordModal} onOpenChange={(o) => { if (!o && !passwordLoading) { setShowPasswordModal(false); setPwForm({ current: "", newPw: "", confirm: "" }); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password, then choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input type={showPwFields.current ? "text" : "password"} placeholder="Enter current password"
                  value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  className="h-11 pr-10" disabled={passwordLoading} autoFocus />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPwFields(s => ({ ...s, current: !s.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPwFields.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input type={showPwFields.newPw ? "text" : "password"} placeholder="Min. 6 characters"
                  value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                  className="h-11 pr-10" disabled={passwordLoading} />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPwFields(s => ({ ...s, newPw: !s.newPw }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPwFields.newPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input type={showPwFields.confirm ? "text" : "password"} placeholder="Repeat new password"
                  value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  className="h-11 pr-10" disabled={passwordLoading} />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPwFields(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPwFields.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-11"
                onClick={() => { setShowPasswordModal(false); setPwForm({ current: "", newPw: "", confirm: "" }); }}
                disabled={passwordLoading}>Cancel</Button>
              <Button className="flex-1 h-11" onClick={handlePasswordChange} disabled={passwordLoading}>
                {passwordLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</> : "Change Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Google 2FA ────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Google 2FA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Two-factor authentication adds a second verification step on login.
          </p>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${twoFAEnabled ? "bg-green-500" : "bg-gray-400"}`} />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {twoFAEnabled ? "Enabled" : "Disabled"}
                </p>
                {twoFAEnabled && twoFAEnabledAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Since {fmtDate(twoFAEnabledAt)}</p>
                )}
              </div>
            </div>
            <Button
              variant={twoFAEnabled ? "outline" : "default"}
              size="sm"
              onClick={handleToggle2FA}
              disabled={twoFALoading}
            >
              {twoFALoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : twoFAEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use Google Authenticator or any TOTP app. Backup codes are not supported — keep your secret key safe.
          </p>
        </CardContent>
      </Card>

      {/* 2FA Setup Modal */}
      {showTwoFASetup && twoFASetupData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Set Up Google Authenticator</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
            <div className="flex justify-center mb-4">
              <img src={twoFASetupData.qrDataUrl} alt="2FA QR Code" className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">Or enter this secret manually:</p>
            <p className="font-mono text-xs bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 text-center mb-4 break-all">{twoFASetupData.secret}</p>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code"
              value={twoFASetupCode} onChange={e => setTwoFASetupCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-xl font-mono mb-4 px-3" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowTwoFASetup(false); setTwoFASetupData(null); setTwoFASetupCode(""); }}>Cancel</Button>
              <Button className="flex-1" disabled={twoFALoading || twoFASetupCode.length !== 6} onClick={handleConfirmEnable2FA}>
                {twoFALoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Disable Modal */}
      {showTwoFADisable && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Disable 2FA</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter your Security PIN to confirm disabling Google 2FA.</p>
            <input type="password" inputMode="numeric" maxLength={4} placeholder="4-digit Security PIN"
              value={twoFADisablePin} onChange={e => setTwoFADisablePin(e.target.value.replace(/\D/g, ""))}
              className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-xl tracking-widest mb-4 px-3" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowTwoFADisable(false); setTwoFADisablePin(""); }}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={twoFALoading || twoFADisablePin.length !== 4} onClick={handleDisable2FA}>
                {twoFALoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disable 2FA"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── USDT Wallet ───────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            USDT Wallet (BEP-20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usdtDisplayMode && usdtAddress ? (
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{maskAddress(usdtAddress)}</span>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                    Saved
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-medium">BEP-20</span>
                  <span>BSC Network</span>
                  {usdtSavedAt && <span>· Saved {fmtDate(usdtSavedAt)}</span>}
                </div>
              </div>
              <Button variant="outline" className="w-full h-11" onClick={() => setUsdtDisplayMode(false)}>
                <Edit className="h-4 w-4 mr-2" />Edit Wallet Address
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>BEP-20 Wallet Address</Label>
                <Input
                  placeholder="0x... (BEP-20 address)"
                  value={usdtInputValue}
                  onChange={e => setUsdtInputValue(e.target.value)}
                  className="h-11 font-mono text-sm"
                  disabled={savingUsdt}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">Only BEP-20 (Binance Smart Chain) is supported.</p>
              </div>
              <div className="flex gap-3">
                {usdtAddress && (
                  <Button variant="outline" className="flex-1 h-11" onClick={() => {
                    setUsdtInputValue(usdtAddress);
                    setUsdtDisplayMode(true);
                  }} disabled={savingUsdt}>
                    Cancel
                  </Button>
                )}
                <Button className={`h-11 ${usdtAddress ? "flex-1" : "w-full"}`} onClick={handleSaveUSDT} disabled={savingUsdt}>
                  {savingUsdt ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Wallet Address"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bank Details — only shown while geo is settled ──────── */}
      {geo.loading ? (
        <Card className="mb-6 animate-pulse">
          <CardContent className="p-5">
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-64 bg-gray-100 dark:bg-gray-800 rounded" />
          </CardContent>
        </Card>
      ) : isNigerian() ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bank Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bankDisplayMode && bankDetails.accountNumber ? (
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{bankDetails.accountName}</p>
                      <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{maskAccount(bankDetails.accountNumber)}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                      Saved
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{bankDetails.bankName}</span>
                    {bankSavedAt && <span>· Saved {fmtDate(bankSavedAt)}</span>}
                  </div>
                </div>
                <Button variant="outline" className="w-full h-11" onClick={() => {
                  setBankInputValue(bankDetails);
                  setBankDisplayMode(false);
                }}>
                  <Edit className="h-4 w-4 mr-2" />Edit Bank Details
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input placeholder="Full name as on bank account"
                    value={bankInputValue.accountName}
                    onChange={e => setBankInputValue(p => ({ ...p, accountName: e.target.value }))}
                    className="h-11" disabled={savingBank} />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input placeholder="10-digit account number"
                    value={bankInputValue.accountNumber}
                    onChange={e => setBankInputValue(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") }))}
                    className="h-11" maxLength={10} disabled={savingBank} />
                </div>
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input placeholder="e.g. First Bank, Zenith Bank"
                    value={bankInputValue.bankName}
                    onChange={e => setBankInputValue(p => ({ ...p, bankName: e.target.value }))}
                    className="h-11" disabled={savingBank} />
                </div>
                <div className="flex gap-3">
                  {bankDetails.accountNumber && (
                    <Button variant="outline" className="flex-1 h-11" onClick={() => setBankDisplayMode(true)} disabled={savingBank}>
                      Cancel
                    </Button>
                  )}
                  <Button className={`h-11 ${bankDetails.accountNumber ? "flex-1" : "w-full"}`}
                    onClick={handleSaveBankDetails} disabled={savingBank}>
                    {savingBank ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Bank Details"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : geo.error && !geo.country ? (
        /* Unknown location — cannot determine region */
        <Card className="mb-6 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Building2 className="h-5 w-5" />
              Bank Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Unable to determine your location.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Please refresh the page or select your country manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Non-Nigerian — bank setup unavailable in this region */
        <Card className="mb-6 border-amber-200 dark:border-amber-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Building2 className="h-5 w-5" />
              Bank Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Unavailable in your region.
            </p>
            {geo.country && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Detected location: <span className="font-medium">{geo.country}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══ Modals ══════════════════════════════════════════════ */}

      {/* Create PIN modal */}
      <Dialog open={showCreatePinModal} onOpenChange={(o) => { if (!o && !savingPin) { setShowCreatePinModal(false); setPinForm({ newPin: "", confirmPin: "", currentPin: "" }); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Security PIN</DialogTitle>
            <DialogDescription>
              Choose a 4-digit PIN. It will be required for withdrawals and account changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>New PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="4 digits"
                value={pinForm.newPin}
                onChange={e => setPinForm(p => ({ ...p, newPin: e.target.value.replace(/\D/g, "") }))}
                className="h-11 tracking-widest text-center text-xl" disabled={savingPin} />
            </div>
            <div className="space-y-2">
              <Label>Confirm PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="Repeat PIN"
                value={pinForm.confirmPin}
                onChange={e => setPinForm(p => ({ ...p, confirmPin: e.target.value.replace(/\D/g, "") }))}
                className="h-11 tracking-widest text-center text-xl" disabled={savingPin} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avoid simple patterns like 1234, 0000, or repeated digits.</p>
            <Button className="w-full h-11" onClick={handleCreatePin} disabled={savingPin}>
              {savingPin ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit PIN modal */}
      <Dialog open={showEditPinModal} onOpenChange={(o) => { if (!o && !savingPin) { setShowEditPinModal(false); setPinForm({ newPin: "", confirmPin: "", currentPin: "" }); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Security PIN</DialogTitle>
            <DialogDescription>Enter your current PIN, then choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Current PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="Current 4-digit PIN"
                value={pinForm.currentPin}
                onChange={e => setPinForm(p => ({ ...p, currentPin: e.target.value.replace(/\D/g, "") }))}
                className="h-11 tracking-widest text-center text-xl" disabled={savingPin} />
            </div>
            <div className="space-y-2">
              <Label>New PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="4 digits"
                value={pinForm.newPin}
                onChange={e => setPinForm(p => ({ ...p, newPin: e.target.value.replace(/\D/g, "") }))}
                className="h-11 tracking-widest text-center text-xl" disabled={savingPin} />
            </div>
            <div className="space-y-2">
              <Label>Confirm New PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="Repeat new PIN"
                value={pinForm.confirmPin}
                onChange={e => setPinForm(p => ({ ...p, confirmPin: e.target.value.replace(/\D/g, "") }))}
                className="h-11 tracking-widest text-center text-xl" disabled={savingPin} />
            </div>
            <Button className="w-full h-11" onClick={handleEditPin} disabled={savingPin}>
              {savingPin ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</> : "Update PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security PIN Dialog for Bank Details */}
      <SecurityPINDialog
        open={showPINForBank}
        onClose={() => { setShowPINForBank(false); setPendingBankDetails(null); }}
        onSuccess={handleBankPINSuccess}
        title="Confirm Security PIN"
        description="Enter your 4-digit security PIN to save bank details"
      />

      {/* Security PIN Dialog for Wallet Address */}
      <SecurityPINDialog
        open={showPINForWallet}
        onClose={() => { setShowPINForWallet(false); setPendingWalletAddress(null); }}
        onSuccess={handleWalletPINSuccess}
        title="Confirm Security PIN"
        description="Enter your 4-digit security PIN to save your wallet address"
      />
    </ResponsiveLayout>
  );
}
