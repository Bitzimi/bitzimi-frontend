import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import logo from "../../imports/1000109381-1.png";
import { usePlatform } from "../contexts/PlatformContext";
import { requestPasswordReset } from "../services/backendAuthService";

export function ForgotPassword() {
  const { branding } = usePlatform();
  const [email, setEmail]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await requestPasswordReset(email);
    setIsLoading(false);

    if (!result.ok) {
      if (result.networkError) {
        setError("Unable to reach the server. Please check your connection and try again.");
        return;
      }
      setError("Something went wrong. Please try again.");
      return;
    }

    setSent(true);
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
            {sent ? "Check Your Email" : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-gray-400 text-sm">
            {sent
              ? `A password reset link has been sent to ${email}`
              : "Enter your email to receive a password reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {error && (
            <Alert variant="destructive" className="mb-3 py-2 border-red-500/50 bg-red-950/30">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-200 text-sm">Email Address</Label>
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

              <Button
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-900/40 transition-all"
                disabled={isLoading}
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Alert className="py-3 border-green-500/50 bg-green-950/30">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300 text-sm">
                  If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox and follow the link to reset your password.
                </AlertDescription>
              </Alert>
              <p className="text-xs text-gray-500 text-center">
                The link will expire in 1 hour. Didn&apos;t receive it? Check your spam folder.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-9 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Try a different email
              </Button>
            </div>
          )}

          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
