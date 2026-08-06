import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

interface SecurityPINDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (pinToken?: string) => void;
  title: string;
  description: string;
}

export function SecurityPINDialog({ open, onClose, onSuccess, title, description }: SecurityPINDialogProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);
    setPin(digitsOnly);
    if (error) setError("");
  };

  const handleVerify = async () => {
    if (pin.length !== 4) { setError("Please enter a 4-digit PIN"); return; }
    setLoading(true); setError("");
    try {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${API_BASE}/api/v1/users/me/security-pin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Incorrect PIN. Please try again.";
        setError(msg);
        setPin("");
        return;
      }
      onSuccess(json?.data?.token);
      handleClose();
    } catch (err: any) {
      const msg = err?.message ?? "PIN verification failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPin(""); setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); handleVerify(); }} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="pin-input" className="text-center block text-sm font-medium">
              Enter 4-Digit PIN
            </Label>
            <Input
              id="pin-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoFocus
              maxLength={4}
              value={pin}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0000"
              className="w-full h-14 text-center text-3xl font-bold tracking-[0.5em] pl-8"
              disabled={loading}
            />
            {error
              ? <p className="text-xs text-center text-red-500">{error}</p>
              : <p className="text-xs text-center text-gray-500 dark:text-gray-400">{pin.length}/4 digits</p>
            }
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pin.length !== 4 || loading}>
              {loading ? "Verifying…" : "Verify"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
