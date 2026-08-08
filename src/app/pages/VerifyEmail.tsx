import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CheckCircle2, AlertCircle, Mail, Loader2 } from "lucide-react";
import { verifyEmailToken, sendVerificationEmailFrontend } from "../services/backendAuthService";
import logo from "../../imports/1000109381-1.png";
import { usePlatform } from "../contexts/PlatformContext";

export function VerifyEmail() {
  const { branding } = usePlatform();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // If no token in URL, show "check your email" state with resend option
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle",
  );
  const [errorCode, setErrorCode] = useState("");

  // Resend state
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Auto-verify on mount if token is present
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    verifyEmailToken(token).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setStatus("success");
      } else {
        setErrorCode(result.errorCode ?? "TOKEN_INVALID");
        setStatus("error");
      }
    });

    return () => { cancelled = true; };
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail || resendStatus === "sending") return;
    setResendStatus("sending");
    const result = await sendVerificationEmailFrontend(resendEmail);
    setResendStatus(result.networkError ? "error" : "sent");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/50 backdrop-blur-lg border-gray-700/80 shadow-2xl">
        <CardHeader className="space-y-0.5 pb-3">
          <div className="text-center mb-2">
            <img src={branding.logoUrl || logo} alt={branding.name} className="h-9 mx-auto mb-1.5" />
            <p className="text-xs text-purple-400/90">Play, Earn & Compete Securely</p>
          </div>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-400" />
            Email Verification
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            {status === "idle"
              ? "A verification link has been sent to your email."
              : status === "verifying"
              ? "Verifying your email address…"
              : status === "success"
              ? "Your email has been verified."
              : "This verification link is invalid or has expired."}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Verifying spinner */}
          {status === "verifying" && (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin" />
              <p className="text-sm text-gray-400">Please wait…</p>
            </div>
          )}

          {/* Success state */}
          {status === "success" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-5 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-green-300 font-semibold text-base">Email verified successfully!</p>
                <p className="text-sm text-gray-400 mt-1">You can now sign in to your account.</p>
              </div>
              <Link to="/login">
                <Button className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
                  Sign In
                </Button>
              </Link>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="space-y-4">
              <Alert variant="destructive" className="border-red-500/50 bg-red-950/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {errorCode === "TOKEN_INVALID"
                    ? "This verification link has expired or has already been used."
                    : "Verification failed. Please request a new link."}
                </AlertDescription>
              </Alert>
              <ResendForm
                email={resendEmail}
                setEmail={setResendEmail}
                status={resendStatus}
                onResend={handleResend}
              />
            </div>
          )}

          {/* No token / "check your email" state */}
          {status === "idle" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-5 text-center">
                <Mail className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                <p className="text-purple-200 font-semibold">Check your inbox</p>
                <p className="text-sm text-gray-400 mt-1">
                  Click the link we sent to verify your email address. The link expires in 24 hours.
                </p>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400 mb-3 text-center">Didn&apos;t receive it? Resend below.</p>
                <ResendForm
                  email={resendEmail}
                  setEmail={setResendEmail}
                  status={resendStatus}
                  onResend={handleResend}
                />
              </div>
            </div>
          )}

          <div className="text-center text-sm">
            <Link to="/login" className="text-gray-500 hover:text-gray-400 transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResendForm({
  email, setEmail, status, onResend,
}: {
  email: string;
  setEmail: (v: string) => void;
  status: "idle" | "sending" | "sent" | "error";
  onResend: () => void;
}) {
  if (status === "sent") {
    return (
      <Alert className="border-green-500/50 bg-green-950/30 py-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
        <AlertDescription className="text-xs text-green-300">
          If an account exists for that email, a new verification link has been sent.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {status === "error" && (
        <Alert variant="destructive" className="py-2 border-red-500/50 bg-red-950/30">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">Unable to reach the server. Please try again.</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label className="text-gray-200 text-sm">Email address</Label>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 bg-gray-900/40 border-gray-600/60 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-2 transition-all"
        />
      </div>
      <Button
        className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
        onClick={onResend}
        disabled={!email || status === "sending"}
      >
        {status === "sending" ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
        ) : "Resend Verification Email"}
      </Button>
    </div>
  );
}
