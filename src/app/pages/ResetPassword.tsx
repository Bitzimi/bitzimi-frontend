import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import logo from "../../imports/1000109381-1.png";
import { usePlatform } from "../contexts/PlatformContext";
import { resetPasswordWithToken } from "../services/backendAuthService";

export function ResetPassword() {
  const { branding } = usePlatform();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const result = await resetPasswordWithToken(token, newPassword);
    setIsLoading(false);

    if (!result.ok) {
      if (result.networkError) {
        setError("Unable to reach the server. Please check your connection and try again.");
      } else if (result.errorCode === "TOKEN_INVALID") {
        setError("This reset link has expired or already been used. Please request a new one.");
      } else {
        setError("Password reset failed. Please try again.");
      }
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/login"), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/50 backdrop-blur-lg border-gray-700/80 shadow-2xl">
        <CardHeader className="space-y-0.5 pb-3">
          <div className="text-center mb-2">
            <img src={branding.logoUrl || logo} alt={branding.name} className="h-9 mx-auto mb-1.5" />
            <p className="text-xs text-purple-400/90">Play, Earn & Compete Securely</p>
          </div>
          <CardTitle className="text-xl text-white">
            {success ? "Password Reset" : "Create New Password"}
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            {success
              ? "Your password has been successfully reset."
              : "Choose a strong new password for your account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {error && (
            <Alert variant="destructive" className="mb-3 py-2 border-red-500/50 bg-red-950/30">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <div className="space-y-3">
              <Alert className="py-3 border-green-500/50 bg-green-950/30">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300 text-sm">
                  Your password has been reset. You will be redirected to login shortly.
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => navigate("/login")}
                className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-900/40 transition-all"
              >
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-gray-200 text-sm">
                  New Password <span className="text-xs text-gray-500 font-normal">(min. 8 characters)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 pr-10 bg-gray-900/40 border-gray-600/60 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-2 transition-all"
                    required
                    disabled={!token}
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-gray-200 text-sm">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 bg-gray-900/40 border-gray-600/60 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-2 transition-all"
                  required
                  disabled={!token}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-900/40 transition-all"
                disabled={isLoading || !token}
              >
                {isLoading ? "Resetting…" : "Reset Password"}
              </Button>
            </form>
          )}

          {!success && (
            <div className="mt-4 text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Request a new reset link
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
