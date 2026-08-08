import { useState, useCallback, useEffect, useRef } from "react";

interface CaptchaProps {
  onVerify: (verified: boolean) => void;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5-minute auto-reset
const MAX_ATTEMPTS_BEFORE_COOLDOWN = 3;
const COOLDOWN_SECONDS = 30;

function generateChallenge() {
  const type = Math.floor(Math.random() * 3);
  if (type === 0) {
    const a = Math.floor(Math.random() * 20) + 5;
    const b = Math.floor(Math.random() * 15) + 2;
    return { question: `${a} + ${b}`, answer: a + b };
  } else if (type === 1) {
    const a = Math.floor(Math.random() * 20) + 15;
    const b = Math.floor(Math.random() * 12) + 2;
    return { question: `${a} − ${b}`, answer: a - b };
  } else {
    const a = Math.floor(Math.random() * 7) + 2;
    const b = Math.floor(Math.random() * 7) + 2;
    return { question: `${a} × ${b}`, answer: a * b };
  }
}

type Status = "idle" | "success" | "error" | "cooldown";

export function Captcha({ onVerify }: CaptchaProps) {
  const [challenge, setChallenge] = useState(generateChallenge);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [attempts, setAttempts] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [shake, setShake] = useState(false);
  const createdAtRef = useRef(Date.now());
  const ttlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-reset after TTL
  useEffect(() => {
    if (status !== "success") {
      ttlTimerRef.current = setTimeout(() => {
        reset(false);
      }, CHALLENGE_TTL_MS);
    }
    return () => { if (ttlTimerRef.current) clearTimeout(ttlTimerRef.current); };
  }, [challenge]);

  // Cooldown countdown
  useEffect(() => {
    if (status !== "cooldown") return;
    cooldownRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          reset(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [status]);

  const reset = useCallback((notifyParent = true) => {
    if (ttlTimerRef.current) clearTimeout(ttlTimerRef.current);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setChallenge(generateChallenge());
    setInput("");
    setStatus("idle");
    setAttempts(0);
    setCooldownRemaining(0);
    setShake(false);
    createdAtRef.current = Date.now();
    if (notifyParent) onVerify(false);
  }, [onVerify]);

  const verify = useCallback(() => {
    if (status !== "idle" || !input) return;

    if (parseInt(input, 10) === challenge.answer) {
      if (ttlTimerRef.current) clearTimeout(ttlTimerRef.current);
      setStatus("success");
      onVerify(true);
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setStatus("error");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      onVerify(false);

      if (next >= MAX_ATTEMPTS_BEFORE_COOLDOWN) {
        setTimeout(() => {
          setStatus("cooldown");
          setCooldownRemaining(COOLDOWN_SECONDS);
          setChallenge(generateChallenge());
          setInput("");
          setAttempts(0);
        }, 700);
      } else {
        setTimeout(() => {
          setChallenge(generateChallenge());
          setInput("");
          setStatus("idle");
        }, 800);
      }
    }
  }, [input, challenge.answer, attempts, status, onVerify]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input && status === "idle") verify();
  };

  const isCooldown = status === "cooldown";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      className={`
        rounded-xl border px-4 py-3 transition-all duration-300
        ${shake ? "animate-[wiggle_0.4s_ease-in-out]" : ""}
        ${isSuccess
          ? "border-green-500/50 bg-green-500/5 shadow-sm shadow-green-500/10"
          : isError
          ? "border-red-500/50 bg-red-500/5"
          : isCooldown
          ? "border-orange-400/40 bg-orange-500/5"
          : "border-gray-600/60 bg-gray-900/40 backdrop-blur-sm"
        }
      `}
      style={{ animationFillMode: "both" }}
    >
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>

      {isSuccess ? (
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0 scale-100 transition-transform duration-200">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-medium text-green-400">Verified — you're human</span>
        </div>
      ) : isCooldown ? (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-orange-400/60 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-orange-300 font-medium">Too many attempts</p>
            <p className="text-xs text-orange-400/70 mt-0.5">
              New challenge in {cooldownRemaining}s
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">Solve:</span>
            <span className="text-sm text-gray-100 font-mono font-semibold shrink-0 select-none">
              {challenge.question} =
            </span>
            <input
              type="number"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              onKeyDown={handleKeyDown}
              placeholder="?"
              aria-label="CAPTCHA answer"
              disabled={status !== "idle"}
              className={`
                w-14 h-8 rounded-lg px-2 text-center text-sm font-mono bg-gray-800 border outline-none
                focus:ring-1 transition-all duration-200
                ${isError
                  ? "border-red-500/70 text-red-300 focus:ring-red-500/30"
                  : "border-gray-600 text-white focus:border-purple-500/60 focus:ring-purple-500/20"
                }
              `}
            />
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={!input || status !== "idle"}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-600 active:scale-95 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            Verify
          </button>
        </div>
      )}

      {isError && !isCooldown && (
        <p className="text-xs text-red-400 mt-1.5 transition-opacity duration-200">
          Incorrect. {MAX_ATTEMPTS_BEFORE_COOLDOWN - attempts > 0
            ? `${MAX_ATTEMPTS_BEFORE_COOLDOWN - attempts} attempt${MAX_ATTEMPTS_BEFORE_COOLDOWN - attempts > 1 ? "s" : ""} remaining.`
            : ""}
        </p>
      )}
    </div>
  );
}
