import { useState, useRef, useEffect, useCallback } from "react";

// ── Backend API helper ──────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function apiFetch(path: string, options?: RequestInit) {
  if (!API_BASE || !getToken()) return null; // graceful no-op if no backend
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((json as any)?.error?.message ?? "API error"), { code: (json as any)?.error?.code, status: res.status });
    return json;
  } catch { return null; }
}
import { logoutFromBackend, deactivateAccount } from "../services/backendAuthService";
import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Edit,
  Calendar,
  Trophy,
  Shield,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Trash2,
  Crown,
  Gift,
  Flame,
  Star,
  Lock,
  Search,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "../contexts/WalletContext";
import { useSettings } from "../contexts/SettingsContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useVerification } from "../contexts/VerificationContext";
import { useIdentity, dispatchIdentityUpdate } from "../contexts/IdentityContext";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { useNotifications } from "../contexts/NotificationContext";
import { userProfileService } from "../services/userProfileService";
import { phoneVerificationService } from "../services/phoneVerificationService";
import { SUPPORTED_COUNTRIES, getCountryByCode } from "../constants/countries";
import { useGeoLocation } from "../hooks/useGeoLocation";

export default function Profile() {
  const navigate = useNavigate();
  const { balances, getTotalBalance, gameEarnings } = useWallet();
  const { formatCurrency, formatCurrencyNoDecimals, currency, t } = useSettings();
  const { stats } = useGameStats();
  const { isVerified, verificationStatus: ctxVerificationStatus } = useVerification();
  const { identity, refreshIdentity } = useIdentity();
  const { addNotification } = useNotifications();
  const geo = useGeoLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [verificationStatus, setVerificationStatus] = useState<"unverified" | "pending" | "verified">("unverified");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasVIP, setHasVIP] = useState(false);
  const [showVIPBenefitsDialog, setShowVIPBenefitsDialog] = useState(false);
  const [vipDaysRemaining, setVipDaysRemaining] = useState(0);

  // User profile from service
  const [userProfile, setUserProfile] = useState(userProfileService.getProfile());

  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("bitzimiUser") || "{}");

  // Edit modals
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Account deactivation modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateTOTP, setDeactivateTOTP]         = useState("");
  const [deactivateError, setDeactivateError]       = useState("");
  const [isDeactivating, setIsDeactivating]         = useState(false);
  const [deactivateNeeds2FA, setDeactivateNeeds2FA] = useState(false);

  // Username edit state
  const [editingUsername, setEditingUsername] = useState("");
  const [usernameEditAllowed, setUsernameEditAllowed] = useState(true);
  const [usernameNextEdit, setUsernameNextEdit] = useState("");

  // Phone edit state
  const [editingPhone, setEditingPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [actualCode, setActualCode] = useState("");

  // Address edit state
  const [editingAddress, setEditingAddress] = useState({
    street: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });

  // Phone edit state - Start with empty string to show "Select your country code" placeholder
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("");
  // Country picker for phone modal
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countryPickerSearch, setCountryPickerSearch] = useState("");

  // Game activity data - USE REAL STATS FROM CONTEXT
  const gameActivity = {
    totalGames: stats.totalGames,
    wins: stats.totalWins,
    winRate: stats.winRate,
    totalEarned: stats.totalProfit,
  };

  // ── Backend data loading ────────────────────────────────────────────────────
  const [canEditUsername, setCanEditUsername] = useState(true);
  const [nextUsernameEditAt, setNextUsernameEditAt] = useState<string | null>(null);
  const [addressLocked, setAddressLocked] = useState(false);

  const loadFromBackend = useCallback(async () => {
    // Fetch full profile (address, username rate-limit)
    const profileJson = await apiFetch("/api/v1/users/me/profile");
    if (profileJson?.data) {
      const d = profileJson.data;
      setCanEditUsername(d.canEditUsername ?? true);
      setNextUsernameEditAt(d.nextUsernameEditAt ?? null);
      setAddressLocked(d.addressLockedByVerification ?? false);
      // Sync avatar from backend
      if (d.avatarUrl) {
        setAvatarUrl(d.avatarUrl);
        localStorage.setItem("userAvatar", d.avatarUrl);
      }
    }

    // Fetch game stats from backend
    const statsJson = await apiFetch("/api/v1/games/stats");
    if (statsJson?.data?.overall) {
      const o = statsJson.data.overall;
      // Backend stats are the source of truth; they are also available via GameStatsContext
    }

    // Fetch VIP status from backend
    const vipJson = await apiFetch("/api/v1/vip");
    if (vipJson?.data) {
      const v = vipJson.data;
      setHasVIP(v.isActive ?? false);
      if (v.isActive && v.endsAt) {
        const days = Math.max(0, Math.ceil((new Date(v.endsAt).getTime() - Date.now()) / 86400000));
        setVipDaysRemaining(days);
      }
    }

    // Fetch KYC status from backend
    const kycJson = await apiFetch("/api/v1/kyc");
    if (kycJson?.data) {
      const s = kycJson.data.status;
      if (s === "verified") setVerificationStatus("verified");
      else if (s === "pending" || s === "under_review") setVerificationStatus("pending");
      else setVerificationStatus("unverified");
    }
  }, []);

  // Load profile data on mount and when verification status changes
  useEffect(() => {
    loadProfileData();
    loadFromBackend();
  }, [isVerified, ctxVerificationStatus, identity, loadFromBackend]);

  // Countdown timer for phone verification
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const loadProfileData = () => {
    // Load avatar (fallback to localStorage if backend not available)
    const savedAvatar = localStorage.getItem("userAvatar");
    if (savedAvatar && !avatarUrl) setAvatarUrl(savedAvatar);

    // Load user profile from local service (used for display while backend loads)
    const profile = userProfileService.getProfile();
    setUserProfile(profile);

    if (!profile && userData.fullName && userData.email && userData.username) {
      userProfileService.createProfile(userData.fullName, userData.email, userData.username);
      setUserProfile(userProfileService.getProfile());
    }

    // Use the full verification status from context (includes "pending")
    setVerificationStatus(ctxVerificationStatus as "unverified" | "pending" | "verified");

    // VIP status loaded from backend in loadFromBackend(); default to false
    setHasVIP(false);
  };

  // Username edit handlers (backend via PATCH /api/v1/users/me/username)
  const handleOpenUsernameModal = () => {
    // Use backend rate-limit state
    setUsernameEditAllowed(canEditUsername);
    if (!canEditUsername && nextUsernameEditAt) {
      setUsernameNextEdit(new Date(nextUsernameEditAt).toLocaleDateString());
    }
    setEditingUsername(userProfile?.username || identity.username || "");
    setShowUsernameModal(true);
  };

  const handleSaveUsername = async () => {
    if (!editingUsername || editingUsername.length < 3) { toast.error("Username must be at least 3 characters"); return; }
    try {
      const res = await apiFetch("/api/v1/users/me/username", { method: "PATCH", body: JSON.stringify({ username: editingUsername }) });
      if (res === null) {
        // Backend unavailable — fall back to local
        const result = userProfileService.updateUsername(editingUsername);
        if (result.success) { toast.success(result.message); setUserProfile(userProfileService.getProfile()); refreshIdentity(); setShowUsernameModal(false); }
        else toast.error(result.message);
        return;
      }
      toast.success("Username updated successfully");
      userProfileService.updateUsername(editingUsername); // sync local cache
      setUserProfile(userProfileService.getProfile());
      refreshIdentity();
      setShowUsernameModal(false);
      setCanEditUsername(false);
      const next = new Date(Date.now() + 30 * 86400000).toISOString();
      setNextUsernameEditAt(next);
    } catch (err: any) {
      if ((err as any).code === "USERNAME_EDIT_COOLDOWN") {
        toast.error("Username can only be changed once per 30 days");
        setCanEditUsername(false);
      } else if ((err as any).code === "USERNAME_TAKEN") {
        toast.error("Username is already taken");
      } else {
        toast.error(err.message ?? "Failed to update username");
      }
    }
  };

  // Phone edit handlers
  const handleOpenPhoneModal = () => {
    setEditingPhone(userProfile?.phoneNumber || "");
    setShowCodeInput(false);
    setVerificationCode("");

    // If phone is verified, show the saved country code
    if (userProfile?.phoneVerified && userProfile?.phoneCountryCode) {
      setSelectedCountryCode(userProfile.phoneCountryCode);
    } else if (!geo.loading && geo.countryCode) {
      // Auto-select country from IP geolocation
      const detectedCountry = getCountryByCode(geo.countryCode);
      setSelectedCountryCode(detectedCountry?.phoneCode || "+1");
    } else {
      setSelectedCountryCode("+1"); // safe default until geo loads
    }

    setShowPhoneModal(true);
  };

  const handleGetCode = () => {
    if (!editingPhone || editingPhone.trim().length < 5) {
      toast.error("Please enter a valid phone number");
      return;
    }

    // Combine country code with phone number for verification
    const fullPhoneNumber = `${selectedCountryCode}${editingPhone}`;
    const result = phoneVerificationService.sendVerificationCode(fullPhoneNumber);

    if (result.success) {
      toast.success(result.message);
      setShowCodeInput(true);
      setCountdown(300); // 5 minutes
      setActualCode(result.code || "");

      console.log("=".repeat(50));
      console.log("📱 PHONE VERIFICATION CODE:", result.code);
      console.log("📱 Phone:", fullPhoneNumber);
      console.log("=".repeat(50));
    } else {
      toast.error(result.message);
    }
  };

  const handleVerifyPhone = async () => {
    const result = phoneVerificationService.verifyCode(verificationCode);

    if (result.success) {
      const selectedCountry = SUPPORTED_COUNTRIES.find(c => c.phoneCode === selectedCountryCode);
      const fullPhoneNumber = `${selectedCountryCode}${editingPhone}`;

      // Persist phone to backend
      await apiFetch("/api/v1/users/me/phone", {
        method: "PATCH",
        body: JSON.stringify({ phoneNumber: fullPhoneNumber, phoneVerified: true }),
      });

      // Sync local cache
      const updateResult = userProfileService.updatePhone(selectedCountryCode, editingPhone);
      if (updateResult.success) {
        userProfileService.verifyPhone(selectedCountry?.code ?? "", selectedCountry?.name ?? "");
        toast.success("Phone number verified successfully!");
        addNotification("success", "Phone Number Verified", `Your phone number ${fullPhoneNumber} has been verified`, { type: "phone_verification" });
        setUserProfile(userProfileService.getProfile());
        refreshIdentity();
        setShowPhoneModal(false);
      }
    } else {
      toast.error(result.message);
    }
  };

  // Address edit handlers
  const handleOpenAddressModal = () => {
    const canEdit = userProfileService.canEditAddress();
    if (!canEdit.allowed) {
      toast.error(canEdit.reason || "Cannot edit address");
      return;
    }
    // Load existing address components or start fresh
    setEditingAddress(userProfile?.addressComponents || {
      street: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    });
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (!editingAddress.street || !editingAddress.city || !editingAddress.country) {
      toast.error("Please fill in street address, city, and country"); return;
    }

    try {
      await apiFetch("/api/v1/users/me/address", {
        method: "PATCH",
        body: JSON.stringify({
          street:     editingAddress.street,
          city:       editingAddress.city,
          state:      editingAddress.state || undefined,
          country:    editingAddress.country,
          postalCode: editingAddress.postalCode || undefined,
        }),
      });
    } catch (err: any) {
      if ((err as any).code === "ADDRESS_LOCKED") {
        toast.error("Address is locked after identity verification");
        setShowAddressModal(false);
        return;
      }
    }

    // Sync local cache
    const result = userProfileService.updateAddress(editingAddress);
    if (result.success) {
      toast.success(result.message);
      setUserProfile(userProfileService.getProfile());
      refreshIdentity();
      setShowAddressModal(false);
    } else {
      toast.error(result.message);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "image/jpg"];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a valid image (JPG or PNG)");
        return;
      }

      if (file.size > maxSize) {
        toast.error("Image size must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        // Optimistic local update
        setAvatarUrl(imageData);
        localStorage.setItem("userAvatar", imageData);
        dispatchIdentityUpdate();
        // Persist to backend
        const res = await apiFetch("/api/v1/users/me/avatar", {
          method: "POST",
          body: JSON.stringify({ dataUrl: imageData }),
        });
        if (res?.data?.avatarUrl) {
          // Backend may return a different URL (object storage)
          setAvatarUrl(res.data.avatarUrl);
          localStorage.setItem("userAvatar", res.data.avatarUrl);
          dispatchIdentityUpdate();
        }
        toast.success("Avatar updated successfully");
      };
      reader.readAsDataURL(file);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem("bitzimiUser");
    logoutFromBackend(); // revokes refresh token on backend, clears JWTs from localStorage
    navigate("/login");
    toast.success("Logged out successfully");
  };

  const handleDeactivateSubmit = async () => {
    if (!deactivatePassword || isDeactivating) return;
    setDeactivateError("");
    setIsDeactivating(true);

    const result = await deactivateAccount(
      deactivatePassword,
      deactivateTOTP || undefined,
    );

    setIsDeactivating(false);

    if (result.ok) {
      // Clear all local state and navigate to login
      localStorage.removeItem("bitzimiUser");
      localStorage.removeItem("bitzimiWalletBalances");
      localStorage.removeItem("bitzimiNotifications");
      logoutFromBackend().catch(() => {});
      navigate("/login");
      toast.success("Account deactivated. We're sorry to see you go.");
      return;
    }

    if (result.networkError) {
      setDeactivateError("Unable to reach the server. Please try again.");
    } else if (result.errorCode === "2FA_REQUIRED") {
      setDeactivateNeeds2FA(true);
      setDeactivateError("Please enter your 2FA code to confirm.");
    } else if (result.errorCode === "INCORRECT_PASSWORD") {
      setDeactivateError("Incorrect password. Please try again.");
    } else if (result.errorCode === "INVALID_2FA_CODE") {
      setDeactivateError("Invalid 2FA code. Please try again.");
      setDeactivateTOTP("");
    } else {
      setDeactivateError("Failed to deactivate account. Please try again.");
    }
  };

  return (
    <ResponsiveLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden text-4xl text-white">
                  <PlayerAvatar avatar={identity.avatar} />
                </div>
                {/* Verified Badge - Green Checkmark with Seal */}
                {isVerified && (
                  <div className="absolute top-0 right-0">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Starburst/Seal background */}
                      <path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" fill="#059669" />
                      {/* White circle */}
                      <circle cx="12" cy="12" r="7" fill="white" />
                      {/* Green circle */}
                      <circle cx="12" cy="12" r="6" fill="#059669" />
                      {/* White checkmark */}
                      <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shadow-lg transition-colors"
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold mb-2">{identity.username}</h1>
                <div className="space-y-2">
                  {/* VIP Badge — compact fintech pill */}
                  {hasVIP && (
                    <div className="flex items-center justify-center md:justify-start mb-1.5">
                      <button
                        onClick={() => setShowVIPBenefitsDialog(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border border-yellow-500/30 hover:border-yellow-500/60 rounded-full transition-all text-yellow-600 dark:text-yellow-400"
                      >
                        <Crown className="h-3 w-3" />
                        <span className="text-xs font-semibold">VIP</span>
                        <span className="text-xs text-yellow-600/60 dark:text-yellow-400/60">· {vipDaysRemaining}d left</span>
                      </button>
                    </div>
                  )}
                  {/* Verification Badge */}
                  {isVerified && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2 justify-center md:justify-start">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">Verified Account</span>
                    </div>
                  )}
                  {/* Member Since */}
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4 justify-center md:justify-start">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Member since {new Date(userProfile?.createdAt || userData.createdAt || new Date().toISOString()).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("profile.title","Profile Information")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name - Immutable */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Full Name
                  <Lock className="h-3 w-3 text-gray-400" />
                </Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{userProfile?.fullName || userData.fullName || "Not set"}</span>
                </div>
              </div>

              {/* Username - Editable once per 30 days */}
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{identity.username}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenUsernameModal}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>

              {/* Email - Immutable */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Email
                  <Lock className="h-3 w-3 text-gray-400" />
                </Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{userProfile?.email || userData.email || "Not set"}</span>
                </div>
              </div>

              {/* Phone - Verifiable, locked after verification */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Phone Number
                  {userProfile?.phoneVerified && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </Label>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{userProfile?.phoneNumber || "Not set"}</span>
                    {userProfile?.phoneVerified && (
                      <Badge className="text-xs bg-green-100 text-green-700">Verified</Badge>
                    )}
                  </div>
                  {!userProfile?.phoneVerified ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenPhoneModal}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {userProfile?.phoneNumber ? "Verify" : "Add"}
                    </Button>
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Address - Editable until verified */}
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  Address
                  {userProfile?.addressLockedByVerification && <Lock className="h-3 w-3 text-gray-400" />}
                </Label>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{userProfile?.address || "Not set"}</span>
                    {userProfile?.addressLockedByVerification && (
                      <Badge className="text-xs bg-blue-100 text-blue-700">Locked by Verification</Badge>
                    )}
                  </div>
                  {!userProfile?.addressLockedByVerification && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenAddressModal}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t("profile.game_activity","Game Activity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{gameActivity.totalGames}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Games</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{gameActivity.wins}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Wins</div>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{gameActivity.winRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Win Rate</div>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="flex flex-col items-center justify-center min-h-[72px]">
                  {/* Currency symbol + amount on one line - reduce text size to fit */}
                  <div className={`font-bold text-orange-600 break-words px-2 ${
                    ["NGN", "CNY", "INR", "ZAR", "KES"].includes(currency.code) 
                      ? 'text-base'  // Smaller for high-value currencies to prevent overflow
                      : 'text-xl'    // Normal size for USD, EUR, GBP
                  }`}>
                    {formatCurrency(gameActivity.totalEarned)}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Earned</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("profile.account_actions","Account Actions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Verification */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {verificationStatus === "verified" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : verificationStatus === "pending" ? (
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-gray-400" />
                  )}
                  <div>
                    <p className="font-semibold">Account Verification</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {verificationStatus === "verified" 
                        ? "Your account is verified" 
                        : verificationStatus === "pending"
                        ? "Verification in progress..."
                        : "Verify your identity for full access"}
                    </p>
                  </div>
                </div>
                {verificationStatus === "verified" ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Verified
                  </Badge>
                ) : verificationStatus === "pending" ? (
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    Pending
                  </Badge>
                ) : null}
              </div>

              {verificationStatus === "unverified" && (
                <div className="pt-3 border-t">
                  <Button
                    onClick={() => navigate("/identity-verification")}
                    className="w-full"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Verify Your Identity
                  </Button>
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                <div className="text-left">
                  <p className="font-semibold">Logout</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sign out of your account</p>
                </div>
              </div>
            </button>

            {/* Delete Account */}
            <button
              onClick={() => {
                setShowDeactivateModal(true);
                setDeactivatePassword("");
                setDeactivateTOTP("");
                setDeactivateError("");
                setDeactivateNeeds2FA(false);
              }}
              className="w-full p-4 border border-red-200 dark:border-red-900 rounded-lg flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="h-6 w-6 text-red-600" />
                <div className="text-left">
                  <p className="font-semibold text-red-600">Deactivate Account</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Deactivate your account and end all sessions</p>
                </div>
              </div>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* VIP Benefits Dialog — premium redesign */}
      <Dialog open={showVIPBenefitsDialog} onOpenChange={setShowVIPBenefitsDialog}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 px-5 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-200" />
                <span className="text-xs font-semibold uppercase tracking-widest text-yellow-100">VIP Membership</span>
              </div>
              <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded-full">{vipDaysRemaining}d remaining</span>
            </div>
            <p className="text-sm text-yellow-100/80 mt-2">Active membership · All features unlocked</p>
          </div>

          {/* Benefits grid */}
          <div className="px-5 py-4 space-y-2.5">
            {[
              { label: "Daily Withdrawal", value: "$10,000" },
              { label: "Monthly Withdrawal", value: "$100,000" },
              { label: "Task Earnings Rate", value: "65%" },
              { label: "Daily Streak Rewards", value: `${formatCurrency(0.05)}–${formatCurrency(0.5)}/day` },
              { label: "Football AI Predictions", value: "Full access" },
              { label: "Customer Support", value: "Priority" },
              { label: "Referral Commission", value: "+2% bonus" },
            ].map(b => (
              <div key={b.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{b.value}</span>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5 pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground pt-3 mb-3">
              Subscription managed from your Wallet page.
            </p>

            <Button
              onClick={() => setShowVIPBenefitsDialog(false)}
              className="w-full h-11"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Username Edit Modal */}
      <Dialog open={showUsernameModal} onOpenChange={setShowUsernameModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>
              {usernameEditAllowed
                ? "You can edit your username once every 30 days"
                : `You can edit your username again on ${usernameNextEdit}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {usernameEditAllowed ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-username">New Username</Label>
                  <Input
                    id="edit-username"
                    value={editingUsername}
                    onChange={(e) => setEditingUsername(e.target.value)}
                    placeholder="Enter new username"
                    minLength={3}
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-500">3-20 characters</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowUsernameModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveUsername}
                    className="flex-1"
                    disabled={editingUsername.length < 3 || editingUsername.length > 20}
                  >
                    Save Username
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-900 dark:text-orange-100">Cannot Edit Yet</p>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                      You can edit your username once every 30 days. Your next edit will be available on {usernameNextEdit}.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowUsernameModal(false)}
                  className="w-full mt-4"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Phone Verification Modal — professional single-row design */}
      <Dialog open={showPhoneModal} onOpenChange={(o) => {
        if (!o) { setShowPhoneModal(false); setShowCodeInput(false); setVerificationCode(""); setShowCountryPicker(false); setCountryPickerSearch(""); }
      }}>
        <DialogContent className="max-w-sm max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
            <DialogHeader>
              <DialogTitle>Verify Phone Number</DialogTitle>
              <DialogDescription>
                Once verified, your phone number cannot be changed.
                {geo.country && !geo.loading && (
                  <span className="block mt-0.5 text-xs text-primary/80">Detected: {geo.country}</span>
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
                    {/* Country card — Binance-style */}
                    <button
                      type="button"
                      onClick={() => { setShowCountryPicker(true); setCountryPickerSearch(""); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-input bg-muted/30 hover:bg-muted/60 active:bg-muted transition-colors text-left"
                    >
                      {(() => { const c = SUPPORTED_COUNTRIES.find(x => x.phoneCode === selectedCountryCode); return (
                        <>
                          <span className="text-2xl shrink-0 leading-none">{c?.flag ?? "🌐"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c?.name ?? "Select country"}</p>
                            <p className="text-xs text-muted-foreground">{selectedCountryCode || "Tap to select"}</p>
                          </div>
                        </>
                      ); })()}
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                    {/* Phone input row */}
                    <div className="flex h-12 rounded-xl border border-input overflow-hidden focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary transition-all">
                      <div className="flex items-center px-3 bg-muted border-r border-input shrink-0">
                        <span className="text-sm font-mono font-semibold">{selectedCountryCode || "—"}</span>
                      </div>
                      <input
                        type="tel" inputMode="numeric"
                        value={editingPhone}
                        onChange={e => setEditingPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder={(() => { const c = SUPPORTED_COUNTRIES.find(x => x.phoneCode === selectedCountryCode); return c?.placeholder ?? "Phone number"; })()}
                        className="flex-1 h-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60"
                        onKeyDown={e => e.key === "Enter" && handleGetCode()}
                      />
                    </div>
                    {(() => { const c = SUPPORTED_COUNTRIES.find(x => x.phoneCode === selectedCountryCode); return c?.digits ? <p className="text-xs text-muted-foreground">{c.digits} digits required</p> : null; })()}
                  </div>
                )}
                {showCodeInput && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4">
                      <p className="text-xs font-medium text-foreground mb-2">Code sent to {selectedCountryCode} {editingPhone}</p>
                      <div className="bg-background rounded-lg p-3 text-center font-mono text-2xl font-bold tracking-[0.4em] text-primary">{actualCode}</div>
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
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Country picker panel */
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search country or dial code…"
                    value={countryPickerSearch}
                    onChange={e => setCountryPickerSearch(e.target.value)}
                    autoFocus
                    className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-input bg-muted/30 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-1 px-1">
                  {(countryPickerSearch.trim()
                    ? SUPPORTED_COUNTRIES.filter(c =>
                        c.name.toLowerCase().includes(countryPickerSearch.toLowerCase()) ||
                        c.phoneCode.includes(countryPickerSearch) ||
                        c.code.toLowerCase().startsWith(countryPickerSearch.toLowerCase())
                      )
                    : SUPPORTED_COUNTRIES
                  ).map(c => (
                    <button key={c.code} type="button"
                      onClick={() => { setSelectedCountryCode(c.phoneCode); setEditingPhone(""); setShowCountryPicker(false); setCountryPickerSearch(""); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${c.phoneCode === selectedCountryCode ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
                    >
                      <span className="text-xl w-8 text-center shrink-0 leading-none">{c.flag}</span>
                      <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                      <span className="text-sm font-mono text-muted-foreground shrink-0">{c.phoneCode}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-border">
            {showCountryPicker ? (
              <Button variant="outline" className="w-full h-11" onClick={() => { setShowCountryPicker(false); setCountryPickerSearch(""); }}>Back</Button>
            ) : !showCodeInput ? (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setShowPhoneModal(false)}>Cancel</Button>
                <Button className="flex-1 h-11" onClick={handleGetCode} disabled={!selectedCountryCode || editingPhone.length < 5}>Get Code</Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-11" onClick={() => { setShowPhoneModal(false); setShowCodeInput(false); }}>Cancel</Button>
                <Button className="flex-1 h-11" onClick={handleVerifyPhone}
                  disabled={verificationCode.length !== 6}>
                  Confirm & Verify
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Deactivation Modal */}
      <Dialog open={showDeactivateModal} onOpenChange={(o) => {
        if (!o && !isDeactivating) { setShowDeactivateModal(false); setDeactivatePassword(""); setDeactivateTOTP(""); setDeactivateError(""); setDeactivateNeeds2FA(false); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Deactivate Account
            </DialogTitle>
            <DialogDescription>
              This will deactivate your account and sign you out of all devices. Your transaction history, wallet records, and referral data are preserved. This action cannot be undone from the app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {deactivateError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{deactivateError}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="deactivate-password">Confirm your password</Label>
              <Input
                id="deactivate-password"
                type="password"
                placeholder="Enter your current password"
                value={deactivatePassword}
                onChange={(e) => setDeactivatePassword(e.target.value)}
              />
            </div>

            {deactivateNeeds2FA && (
              <div className="space-y-1.5">
                <Label htmlFor="deactivate-totp">2FA Code</Label>
                <Input
                  id="deactivate-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit authenticator code"
                  value={deactivateTOTP}
                  onChange={(e) => setDeactivateTOTP(e.target.value.replace(/\D/g, ""))}
                  className="font-mono tracking-widest text-center text-lg"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeactivateModal(false)}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeactivateSubmit}
                disabled={!deactivatePassword || isDeactivating}
              >
                {isDeactivating ? "Deactivating…" : "Deactivate Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Edit Modal */}
      <Dialog open={showAddressModal} onOpenChange={setShowAddressModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
            <DialogDescription>
              Your address can be edited freely until you submit identity verification. After verification, it will be locked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-street">Street Address</Label>
              <Input
                id="edit-street"
                value={editingAddress.street}
                onChange={(e) => setEditingAddress({ ...editingAddress, street: e.target.value })}
                placeholder="Enter your street address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={editingAddress.city}
                onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })}
                placeholder="Enter your city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-state">State / Province</Label>
              <Input
                id="edit-state"
                value={editingAddress.state}
                onChange={(e) => setEditingAddress({ ...editingAddress, state: e.target.value })}
                placeholder="Enter your state or province"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-country">Country</Label>
              <Select
                value={editingAddress.country}
                onValueChange={(value) => setEditingAddress({ ...editingAddress, country: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.name}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-postal">Postal Code</Label>
              <Input
                id="edit-postal"
                value={editingAddress.postalCode}
                onChange={(e) => setEditingAddress({ ...editingAddress, postalCode: e.target.value })}
                placeholder="Enter your postal code"
              />
            </div>

            {isVerified && (
              <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <strong>Warning:</strong> After submitting verification, your address will be permanently locked and cannot be changed.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddressModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAddress}
                className="flex-1"
              >
                Save Address
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}