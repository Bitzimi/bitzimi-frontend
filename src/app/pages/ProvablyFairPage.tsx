/**
 * Provably Fair — Verify a Round page.
 * Single Verification ID input. Backend retrieves all data automatically.
 */
import { useState } from "react";
import { Shield, CheckCircle, AlertCircle, Loader2, Copy, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { ResponsiveLayout } from "../components/ResponsiveLayout";

const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ?? "http://localhost:3001";

function pfFetch<T>(path: string): Promise<T> {
  const token = localStorage.getItem("bitzimi_access_token");
  return fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Request failed");
    return (json.data ?? json) as T;
  });
}

const GAME_LABELS: Record<string, string> = {
  color_game:   "Color Prediction",
  spin_battle:  "Spin Battle",
  dice_clash:   "Dice Clash",
  pvp_coinflip: "Coin Flip",
  dice_royale:  "Dice Royale",
  dice_arena:   "Dice Arena",
};

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500 dark:text-gray-400">{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-xs bg-gray-50 dark:bg-gray-900" />
        <Button
          variant="outline" size="icon"
          onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); toast.success(`${label} copied`); }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: any }) {
  if (result == null) return null;
  if (typeof result === "string") {
    const colors: Record<string, string> = {
      red:   "bg-red-500",
      blue:  "bg-blue-500",
      heads: "bg-amber-500",
      tails: "bg-indigo-500",
    };
    return (
      <span className={`inline-flex px-3 py-1 rounded-full font-bold text-white text-sm ${colors[result] ?? "bg-gray-500"}`}>
        {result.toUpperCase()}
      </span>
    );
  }
  // Object result (dice clash, coin flip inside object)
  const coinFlip = result?.coinFlip;
  if (coinFlip) return <ResultBadge result={coinFlip} />;
  if (result?.p1Roll !== undefined) {
    return (
      <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
        P1: {result.p1Roll} vs P2: {result.p2Roll}
      </span>
    );
  }
  return <span className="font-mono text-xs">{JSON.stringify(result)}</span>;
}

interface LookupData {
  verificationId:   string;
  gameType:         string;
  settled:          boolean;
  // Color Prediction extras
  roundNumber?:     number;
  dailyRoundNumber?:number;
  displayDate?:     string;
  // All games
  result:           any;
  serverSeed:       string | null;
  serverSeedHash:   string | null;
  clientSeed:       string | null;
  nonce:            number | null;
  verification:     {
    hashValid:      boolean;
    resultValid:    boolean | null;
    computedResult: any;
  } | null;
  settledAt:        string | null;
}

export default function ProvablyFairPage() {
  const [verificationId, setVerificationId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<LookupData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLookup = async () => {
    const id = verificationId.trim().toUpperCase();
    if (!id) { toast.error("Enter a Verification ID"); return; }
    setStatus("loading");
    setData(null);
    setErrorMsg("");
    try {
      const res = await pfFetch<LookupData>(`/api/v1/games/fairness/lookup/${encodeURIComponent(id)}`);
      setData(res);
      setStatus("done");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Verification failed");
      setStatus("error");
    }
  };

  const isColorPrediction = data?.gameType === "color_game";

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Verify a Round</h1>
              <p className="text-sm text-gray-500">Enter your Verification ID to independently verify any game result.</p>
            </div>
          </div>

          {/* Lookup Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provably Fair Verification</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ✓ This round has been generated using BitZimi's Provably Fair cryptographic system.<br />
                Every result can be independently verified.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Verification ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={verificationId}
                    onChange={e => setVerificationId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLookup()}
                    placeholder="e.g. BZM-CP-A1B2C3D4"
                    className="font-mono"
                  />
                  <Button onClick={handleLookup} disabled={status === "loading"} className="shrink-0">
                    {status === "loading"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Search className="h-4 w-4" />
                    }
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Copy the Verification ID from the 🛡️ Verify Fairness button inside any game.
                </p>
              </div>

              {/* Error */}
              {status === "error" && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* Results */}
              {status === "done" && data && (
                <div className="space-y-5 pt-2">
                  {/* Verification Status */}
                  {data.settled && data.verification && (
                    <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                      data.verification.hashValid
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    }`}>
                      {data.verification.hashValid
                        ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        : <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      }
                      <div>
                        <p className="font-semibold text-sm">
                          Verification Status:{" "}
                          {data.verification.hashValid ? "✓ Verified" : "✗ Hash Mismatch"}
                          {data.verification.resultValid === true  && " · Result Matches ✓"}
                          {data.verification.resultValid === false && " · Result Mismatch ✗"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {data.verification.hashValid
                            ? "SHA-256(serverSeed) matches the pre-committed hash. Result is cryptographically verified."
                            : "The server seed does not match the committed hash."}
                        </p>
                      </div>
                    </div>
                  )}

                  {!data.settled && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Round in progress — full verification available after settlement.
                    </div>
                  )}

                  {/* Game info */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Game</Label>
                      <p className="font-semibold text-sm">{GAME_LABELS[data.gameType] ?? data.gameType}</p>
                    </div>

                    {/* Color Prediction — extra fields */}
                    {isColorPrediction && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Display Date</Label>
                          <p className="font-semibold text-sm">{data.displayDate ?? "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Daily Round</Label>
                          <p className="font-semibold text-sm">#{data.dailyRoundNumber ?? "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Backend Round</Label>
                          <p className="font-semibold text-sm">#{data.roundNumber ?? "—"}</p>
                        </div>
                      </>
                    )}

                    {data.result != null && (
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Result</Label>
                        <div><ResultBadge result={data.result?.result ?? data.result} /></div>
                      </div>
                    )}
                  </div>

                  {/* Seed fields */}
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
                    <CopyRow label="Verification ID" value={data.verificationId ?? ""} />
                    {data.serverSeedHash && <CopyRow label="Server Seed Hash" value={data.serverSeedHash} />}
                    {data.settled && data.serverSeed && <CopyRow label="Server Seed" value={data.serverSeed} />}
                    {data.clientSeed && <CopyRow label="Client Seed" value={data.clientSeed} />}
                    {data.nonce != null && (
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Nonce</Label>
                        <Input value={String(data.nonce)} readOnly className="font-mono text-xs bg-gray-50 dark:bg-gray-900 w-32" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How Provably Fair Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              {[
                ["1. Commitment", "Before each round, the server generates a random seed and publishes its SHA-256 hash. This hash is shown to all players before any bets are placed."],
                ["2. Locking", "Once bets are locked, a client seed is derived from public data: the SHA-256 hash of all participant IDs concatenated with the round ID. Neither party can predict this before bets close."],
                ["3. Result", "HMAC-SHA256(serverSeed, clientSeed:nonce) → 32 bytes. The result is derived deterministically from those bytes. No party can manipulate it."],
                ["4. Reveal", "After settlement, the server seed is revealed. Anyone can verify that SHA-256(serverSeed) matches the pre-committed hash, and that the result follows from the algorithm."],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span className="font-semibold text-foreground shrink-0 w-28">{title}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
