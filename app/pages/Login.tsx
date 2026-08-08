import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Eye, EyeOff, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { Captcha } from "../components/Captcha";
import {
  loginWithBackend,
  complete2FAChallenge,
  sendVerificationEmailFrontend,
} from "../services/backendAuthService";
import logo from "../../imports/1000109381-1.png";
import { usePlatform } from "../contexts/PlatformContext";
import { useSettings } from "../contexts/SettingsContext";

// Device trust token — stored in localStorage, expiry 90 days
const DEVICE_TRUST_KEY    = "bitzimi2FADeviceTrust";
const DEVICE_TRUST_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function isDeviceTrusted(): boolean {
  try {
    const raw = localStorage.getItem(DEVICE_TRUST_KEY);
    if (!raw) return false;
    const { expiresAt } = JSON.parse(raw);
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

function trustDevice(): void {
  localStorage.setItem(
    DEVICE_TRUST_KEY,
    JSON.stringify({ trustedAt: new Date().toISOString(), expiresAt: Date.now() + DEVICE_TRUST_TTL_MS }),
  );
}

export function Login() {
  const navigate = useNavigate();
  const { branding } = usePlatform();
  const { t } = useSettings();
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState("");

  // Email-not-verified state
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [resendStatus, setResendStatus]         = useState<"idle" | "sending" | "sent">("idle");

  // 2FA state
  const [show2FA, setShow2FA]               = useState(false);
  const [twoFACode, setTwoFACode]           = useState("");
  const [trustThisDevice, setTrustThisDevice] = useState(false);
  const [codeError, setCodeError]           = useState("");
  const [is2FAVerifying, setIs2FAVerifying] = useState(false);
  // Challenge token issued by backend when 2FA is required at login
  const [twoFactorChallengeToken, setTwoFactorChallengeToken] = useState("");

  const completeLogin = () => {
    window.dispatchEvent(new CustomEvent("identity-updated"));
    navigate("/wallet");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCaptchaVerified || isLoading) return;

    setError("");
    setIsLoading(true);

    const result = await loginWithBackend(email, password);

    if (!result.ok) {
      setIsLoading(false);
      if (result.networkError) {
        // Backend unreachable — fall back to localStorage session if one exists
        const stored = localStorage.getItem("bitzimiUser");
        if (stored) {
          try {
            const user = JSON.parse(stored);
            if (user.email === email) {
              completeLogin();
              return;
            }
          } catch { /* ignore */ }
        }
        setError("Unable to reach the server. Please check your connection and try again.");
        return;
      }

      if (result.statusCode === 401 || result.errorCode === "INVALID_CREDENTIALS") {
        setError("Invalid email or password. Please try again.");
      } else if (result.errorCode === "EMAIL_NOT_VERIFIED") {
        setShowVerifyPrompt(true);
      } else if (result.errorCode === "ACCOUNT_DELETED") {
        setError("This account has been deactivated. Please contact support if you believe this is an error.");
      } else if (result.statusCode === 403 || result.errorCode === "ACCOUNT_SUSPENDED") {
        setError("Your account has been suspended. Please contact support.");
      } else if (result.statusCode === 429 || result.errorCode === "ACCOUNT_LOCKED") {
        setError("Too many failed attempts. Your account is temporarily locked. Please try again in 15 minutes.");
      } else {
        setError(result.errorMessage ?? "Login failed. Please try again.");
      }
      return;
    }

    setIsLoading(false);

    // Backend signals 2FA is required — show challenge UI
    if (result.requiresTwoFactor && result.twoFactorToken) {
      setTwoFactorChallengeToken(result.twoFactorToken);
      if (!isDeviceTrusted()) {
        setShow2FA(true);
        return;
      }
      // Device trusted but 2FA enabled — still require code (trust skips device prompt, not TOTP)
      setShow2FA(true);
      return;
    }

    completeLogin();
  };

  const handle2FAVerify = async () => {
    if (twoFACode.length !== 6 || is2FAVerifying) return;
    setCodeError("");
    setIs2FAVerifying(true);

    const result = await complete2FAChallenge(twoFactorChallengeToken, twoFACode);
    setIs2FAVerifying(false);

    if (!result.ok) {
      setCodeError(result.errorCode === "TOKEN_INVALID" ? "Session expired. Please log in again." : "Incorrect code. Please try again.");
      setTwoFACode("");
      if (result.errorCode === "TOKEN_INVALID") {
        setShow2FA(false);
        setTwoFactorChallengeToken("");
      }
      return;
    }

    if (trustThisDevice) {
      trustDevice();
    }
    completeLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/50 backdrop-blur-lg border-gray-700/80 shadow-2xl">
        <CardHeader className="space-y-0.5 pb-3">
          <div className="text-center mb-2">
            <img src={branding.logoUrl || logo} alt={branding.name} className="h-9 mx-auto mb-1.5" />
            <p className="text-xs text-purple-400/90">Play, Earn & Compete Securely</p>
          </div>
          {!show2FA ? (
            <>
              <CardTitle className="text-xl text-white">{t("auth.login.subtitle", "Welcome back")}</CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                Enter your credentials to access your account
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-400" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                Enter the 6-digit code from your authenticator app to continue.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {!show2FA ? (
            <form onSubmit={handleLogin} className="space-y-3">
              {error && (
                <Alert variant="destructive" className="py-2 border-red-500/50 bg-red-950/30">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {showVerifyPrompt && (
                <Alert className="py-3 border-yellow-500/50 bg-yellow-950/30">
                  <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                  <AlertDescription className="text-xs text-yellow-200 space-y-2">
                    <p>Please verify your email address before signing in.</p>
                    {resendStatus === "sent" ? (
                      <p className="text-green-300">Verification email sent — check your inbox.</p>
                    ) : (
                      <button
                        type="button"
                        disabled={resendStatus === "sending"}
                        onClick={async () => {
                          setResendStatus("sending");
                          await sendVerificationEmailFrontend(email);
                          setResendStatus("sent");
                        }}
                        className="underline text-yellow-300 hover:text-yellow-100 transition-colors disabled:opacity-50"
                      >
                        {resendStatus === "sending" ? "Sending…" : "Resend verification email"}
                      </button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-200 text-sm">{t("auth.login.email", "Email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 bg-gray-900/40 border-gray-600/60 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-2 transition-all"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-200 text-sm">{t("auth.login.password", "Password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 pr-10 bg-gray-900/40 border-gray-600/60 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-2 transition-all"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end pt-0.5">
                  <Link to="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    {t("auth.login.forgot", "Forgot Password?")}
                  </Link>
                </div>
              </div>

              <Captcha onVerify={setIsCaptchaVerified} />

              <Button
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-900/40 transition-all"
                disabled={!isCaptchaVerified || isLoading}
              >
                {isLoading ? t("common.loading", "Signing in…") : t("auth.login.submit", "Sign In")}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-4 text-center">
                <Shield className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-purple-300">
                  Open your authenticator app and enter the 6-digit code for <strong>Bitzimi</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-200 text-sm">Enter 6-digit code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={twoFACode}
                  onChange={e => { setTwoFACode(e.target.value.replace(/\D/g, "")); setCodeError(""); }}
                  className="h-12 text-center tracking-[0.4em] text-xl font-mono bg-gray-900/40 border-gray-600/60 focus:border-purple-500/60"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && twoFACode.length === 6 && handle2FAVerify()}
                />
                {codeError && <p className="text-xs text-red-400">{codeError}</p>}
              </div>

              {/* Trust this device */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setTrustThisDevice(v => !v)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                    trustThisDevice
                      ? "bg-purple-600 border-purple-600"
                      : "border-gray-500 bg-transparent"
                  }`}
                  aria-label="Trust this device"
                >
                  {trustThisDevice && <CheckCircle2 className="h-3 w-3 text-white" />}
                </button>
                <div>
                  <p className="text-sm text-gray-200">Trust this device</p>
                  <p className="text-xs text-gray-500">Skip 2FA on this device for 90 days</p>
                </div>
              </label>

              <Button
                className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                onClick={handle2FAVerify}
                disabled={twoFACode.length !== 6 || is2FAVerifying}
              >
                {is2FAVerifying ? "Verifying…" : "Verify & Continue"}
              </Button>

              <button
                type="button"
                onClick={() => { setShow2FA(false); setTwoFACode(""); setCodeError(""); }}
                className="w-full text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                ← Back to login
              </button>
            </div>
          )}

          {!show2FA && (
            <>
              <div className="mt-4 text-center text-sm">
                <span className="text-gray-400">{t("auth.login.no_account", "Don't have an account?")} </span>
                <Link to="/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                  {t("auth.login.signup", "Sign up")}
                </Link>
              </div>
              <div className="mt-2 text-center text-sm">
                <Link to="/" className="text-gray-500 hover:text-gray-400 transition-colors">
                  ← Back to Home
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
