import { useState } from "react";
import { X, Shield, Copy, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";
const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ?? "http://localhost:3001";

function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("bitzimi_access_token");
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? json?.error ?? "Request failed");
    return (json.data ?? json) as T;
  });
}

export interface FairnessModalProps {
  isOpen:           boolean;
  onClose:          () => void;
  gameType:         string;
  verificationId?:  string | null;
  roundNumber?:     number;
  dailyRoundNumber?:number;
  serverSeedHash:   string;
  serverSeed?:      string | null;
  clientSeed?:      string | null;
  nonce?:           number | null;
  result?:          any;
}

type VerifyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; hashValid: boolean; resultValid: boolean | null; explanation: string; algorithm: string }
  | { status: "error"; message: string };

export function FairnessModal({
  isOpen, onClose, gameType, verificationId, roundNumber, dailyRoundNumber,
  serverSeedHash, serverSeed, clientSeed, nonce, result,
}: FairnessModalProps) {
  const [verify, setVerify] = useState<VerifyState>({ status: "idle" });

  if (!isOpen) return null;

  const settled  = !!serverSeed && !!clientSeed && nonce != null;
  const canVerify = settled;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(`${label} copied`);
  };

  const handleVerify = async () => {
    if (!canVerify) return;
    setVerify({ status: "loading" });
    try {
      const res = await apiFetch<any>("/api/v1/games/fairness/verify", {
        method: "POST",
        body: JSON.stringify({
          serverSeed, serverSeedHash, clientSeed, nonce, gameType,
          claimedResult: result ?? null,
        }),
      });
      setVerify({
        status:      "done",
        hashValid:   res.hashValid,
        resultValid: res.resultValid,
        explanation: res.explanation,
        algorithm:   res.algorithm,
      });
    } catch (err: any) {
      setVerify({ status: "error", message: err?.message ?? "Verification failed" });
    }
  };

  const GAME_LABELS: Record<string, string> = {
    color_game:   "Color Prediction",
    spin_battle:  "Spin Battle",
    dice_clash:   "Dice Clash",
    pvp_coinflip: "Coin Flip",
    dice_royale:  "Dice Royale",
    dice_arena:   "Dice Arena",
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-950 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold">Provably Fair Verification</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Round / Game info */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{GAME_LABELS[gameType] ?? gameType}</p>
                  {dailyRoundNumber != null && (
                    <p className="text-2xl font-bold">Round #{dailyRoundNumber} <span className="text-sm font-normal text-gray-500">today</span></p>
                  )}
                  {roundNumber != null && (
                    <p className="text-sm text-gray-500">Permanent round #{roundNumber}</p>
                  )}
                </div>
                {result != null && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Result</p>
                    {typeof result === "string" ? (
                      <div className={`inline-flex px-4 py-1.5 rounded-lg font-bold text-white text-sm ${
                        result === "red" ? "bg-red-500" : result === "blue" ? "bg-blue-500" : result === "heads" ? "bg-amber-500" : "bg-indigo-500"
                      }`}>{result.toUpperCase()}</div>
                    ) : (
                      <div className="text-sm font-mono">{JSON.stringify(result)}</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!settled && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Round in progress — server seed will be revealed after settlement so you can verify.
            </div>
          )}

          {/* Verification ID */}
          {verificationId && (
            <div className="space-y-1.5">
              <Label className="font-semibold">Verification ID</Label>
              <div className="flex gap-2">
                <Input value={verificationId} readOnly className="font-mono text-sm bg-gray-50 dark:bg-gray-900" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(verificationId, "Verification ID")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400">Use this ID on the Verify a Round page to look up this round independently.</p>
            </div>
          )}

          {/* Server Seed Hash — always shown (pre-commitment) */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Server Seed Hash <span className="text-xs font-normal text-gray-500">(committed before round)</span></Label>
            <div className="flex gap-2">
              <Input value={serverSeedHash || "—"} readOnly className="font-mono text-xs bg-gray-50 dark:bg-gray-900" />
              {serverSeedHash && (
                <Button variant="outline" size="icon" onClick={() => handleCopy(serverSeedHash, "Server seed hash")}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-400">SHA-256 hash published before any bets — proves server couldn't change the seed.</p>
          </div>

          {/* Server Seed — only after settlement */}
          {settled && serverSeed && (
            <div className="space-y-1.5">
              <Label className="font-semibold">Server Seed <span className="text-xs font-normal text-green-600">(revealed after settlement)</span></Label>
              <div className="flex gap-2">
                <Input value={serverSeed} readOnly className="font-mono text-xs bg-gray-50 dark:bg-gray-900" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(serverSeed, "Server seed")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Client Seed */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Client Seed <span className="text-xs font-normal text-gray-500">(derived from public round data)</span></Label>
            <div className="flex gap-2">
              <Input value={clientSeed ?? "—"} readOnly className="font-mono text-xs bg-gray-50 dark:bg-gray-900" />
              {clientSeed && (
                <Button variant="outline" size="icon" onClick={() => handleCopy(clientSeed, "Client seed")}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-400">SHA-256 of participant IDs + round ID — determined after bets are locked.</p>
          </div>

          {/* Nonce */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Nonce</Label>
            <div className="flex gap-2">
              <Input value={nonce?.toString() ?? "—"} readOnly className="font-mono text-xs bg-gray-50 dark:bg-gray-900 w-48" />
            </div>
            <p className="text-xs text-gray-400">Unique per round — prevents identical seeds from producing identical results.</p>
          </div>

          {/* Verify button */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button
              className="w-full h-12 text-base"
              onClick={handleVerify}
              disabled={!canVerify || verify.status === "loading" || verify.status === "done"}
            >
              {verify.status === "loading" ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying…</>
              ) : verify.status === "done" ? (
                <><CheckCircle className="mr-2 h-5 w-5" /> Verified</>
              ) : (
                <><Shield className="mr-2 h-5 w-5" /> {canVerify ? "Verify Result" : "Available after settlement"}</>
              )}
            </Button>

            {verify.status === "done" && (
              <div className={`mt-4 p-4 rounded-lg border ${
                verify.hashValid
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }`}>
                <div className="flex items-start gap-3">
                  {verify.hashValid
                    ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  }
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">
                      {verify.hashValid ? "Hash verified ✓" : "Hash mismatch ✗"}
                      {verify.resultValid === true && " · Result matches ✓"}
                      {verify.resultValid === false && " · Result mismatch ✗"}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">{verify.explanation}</p>
                    <p className="font-mono text-xs text-gray-400 break-all">{verify.algorithm}</p>
                  </div>
                </div>
              </div>
            )}

            {verify.status === "error" && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                {verify.message}
              </div>
            )}
          </div>

          {/* How it works */}
          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardContent className="pt-5">
              <h3 className="font-semibold mb-3 text-sm">How Provably Fair Works</h3>
              <ol className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 list-decimal list-inside">
                <li>Server generates a random seed and publishes its SHA-256 hash before the round.</li>
                <li>Bets are placed — nobody can change the seed without changing the hash.</li>
                <li>Client seed is derived from public data (player IDs + round ID) after bets lock.</li>
                <li>Result = HMAC-SHA256(serverSeed, "{"{clientSeed}:{nonce}"}") — deterministic.</li>
                <li>After settlement, the server seed is revealed so you can verify it matches the hash.</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
