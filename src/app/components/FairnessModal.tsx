import { X, Shield, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

export interface FairnessModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: string;
  verificationId?: string | null;
  roundNumber?: number;
  dailyRoundNumber?: number;
  serverSeedHash?: string;
  serverSeed?: string | null;
  clientSeed?: string | null;
  nonce?: number | null;
  result?: any;
}

const GAME_LABELS: Record<string, string> = {
  color_game: "Color Prediction", spin_battle: "Spin Battle", dice_clash: "Dice Clash", pvp_coinflip: "Coin Flip", dice_royale: "Dice Royale", dice_arena: "Dice Arena",
};

export function FairnessModal({ isOpen, onClose, gameType, verificationId }: FairnessModalProps) {
  if (!isOpen) return null;
  const copy = () => {
    if (!verificationId) return;
    navigator.clipboard.writeText(verificationId).catch(() => {});
    toast.success("Verification ID copied");
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-green-600" /><h2 className="text-lg font-semibold">Verify Fairness</h2></div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{GAME_LABELS[gameType] ?? gameType}</p>
            <p className="text-sm text-gray-500 mt-1">Use the Verification ID to verify this exact game event in Game Center → Provably Fair Gaming.</p>
          </div>
          {verificationId ? (
            <div className="space-y-2">
              <Label className="font-semibold">Verification ID</Label>
              <div className="flex gap-2">
                <Input value={verificationId} readOnly className="font-mono text-sm bg-gray-50 dark:bg-gray-900" />
                <Button variant="outline" size="icon" onClick={copy} aria-label="Copy Verification ID"><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">Verification ID is not available for this game event.</div>
          )}
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
