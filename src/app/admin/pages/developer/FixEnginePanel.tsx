/**
 * FixEnginePanel — Phase 13.4 Fix Engine UI
 *
 * Displays the real-time step-by-step execution of an approved patch.
 * Auto-starts when a non-null PatchProposal is provided.
 *
 * HARD RULES mirrored from fixEngineService:
 * ─ Only approved patches may be applied (service enforces this).
 * ─ No rollback, no snapshots, no version history (Phase 13.5).
 * ─ Close is disabled during execution.
 */

import { useEffect, useRef, useState } from "react";
import {
  X, CheckCircle2, XCircle, Minus, Wrench,
  Globe, Server, Database, Activity, Layers,
  ShieldCheck, AlertOctagon, Clock, RefreshCw,
  ClipboardList, Hash,
} from "lucide-react";
import {
  fixEngineService,
  STEP_ORDER,
  type FixAuditEntry,
  type FixExecution,
  type FixStep,
  type FixStepId,
  type FixStepStatus,
} from "../../services/fixEngineService";
import type { PatchProposal } from "../../services/patchService";

// ─── Step system icons ────────────────────────────────────────────────────────

const STEP_ICONS: Partial<Record<FixStepId, React.ElementType>> = {
  pre_validation:     ShieldCheck,
  apply_fix:          Wrench,
  build:              Layers,
  compile:            Layers,
  run_tests:          ClipboardList,
  verify_frontend:    Globe,
  verify_backend:     Server,
  verify_database:    Database,
  verify_apis:        Activity,
  verify_integrations: Activity,
};

// ─── Progress stages ──────────────────────────────────────────────────────────

const STAGES = [
  { label: "APPROVED",    steps: [] as FixStepId[] },
  { label: "FIX APPLIED", steps: ["pre_validation", "apply_fix"] as FixStepId[] },
  { label: "VERIFIED",    steps: ["build", "compile", "run_tests", "verify_frontend", "verify_backend", "verify_database", "verify_apis", "verify_integrations"] as FixStepId[] },
  { label: "CLOSED",      steps: [] as FixStepId[] },
];

function getStage(steps: FixStep[], execStatus: string): number {
  if (execStatus === "success") return 3;
  if (execStatus === "failed") return 1;
  if (execStatus === "idle") return 0;
  // running — derive from step states
  const applyDone = steps.find(s => s.id === "apply_fix")?.status === "success";
  const anyVerify = steps.some(s =>
    s.id.startsWith("verify_") && (s.status === "running" || s.status === "success")
  );
  if (anyVerify || applyDone) return 2;
  return 1;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: FixStepStatus }) {
  switch (status) {
    case "running":  return <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />;
    case "success":  return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "failed":   return <XCircle className="w-4 h-4 text-red-400" />;
    case "skipped":  return <Minus className="w-4 h-4 text-zinc-600" />;
    default:         return <div className="w-2 h-2 rounded-full bg-zinc-700 mx-1" />;
  }
}

function StepRow({ step }: { step: FixStep }) {
  const SysIcon = STEP_ICONS[step.id] ?? Activity;
  const isRunning = step.status === "running";
  const isFailed  = step.status === "failed";
  const isSkipped = step.status === "skipped";

  return (
    <div className={`flex items-start gap-3 py-3 px-4 rounded-xl transition-colors ${
      isRunning ? "bg-indigo-500/8 border border-indigo-500/20" :
      isFailed  ? "bg-red-500/8 border border-red-500/15" :
      isSkipped ? "opacity-40" :
      "bg-transparent"
    }`}>
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5 w-5 flex items-center justify-center">
        <StepStatusIcon status={step.status} />
      </div>

      {/* System icon */}
      <div className={`flex-shrink-0 mt-0.5 ${
        isRunning ? "text-indigo-500" :
        isFailed  ? "text-red-500" :
        step.status === "success" ? "text-emerald-600" :
        "text-zinc-700"
      }`}>
        <SysIcon className="w-3.5 h-3.5" />
      </div>

      {/* Label + detail */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${
            isRunning ? "text-indigo-200" :
            isFailed  ? "text-red-300" :
            step.status === "success" ? "text-zinc-200" :
            isSkipped ? "text-zinc-600" :
            "text-zinc-500"
          }`}>
            {step.label}
            {isRunning && <span className="ml-1 text-indigo-400 text-xs animate-pulse">…</span>}
          </span>
          {step.durationMs !== null && step.status !== "skipped" && (
            <span className="text-[10px] text-zinc-600 tabular-nums">
              {step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
          {step.startedAt && step.status === "running" && (
            <span className="text-[10px] text-zinc-600">
              {new Date(step.startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        {step.detail && (
          <p className={`text-[11px] mt-0.5 leading-relaxed ${
            isFailed ? "text-red-400" : isSkipped ? "text-zinc-600" : "text-zinc-500"
          }`}>
            {step.detail}
          </p>
        )}
        {step.errorMessage && (
          <p className="text-[11px] text-red-400 mt-0.5 font-medium">{step.errorMessage}</p>
        )}
      </div>

      {/* Timestamp */}
      {step.completedAt && step.status !== "running" && (
        <div className="flex-shrink-0 text-[10px] text-zinc-700 tabular-nums">
          {new Date(step.completedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ stage, failed }: { stage: number; failed: boolean }) {
  return (
    <div className="flex items-center gap-0 px-6 py-4 border-b border-white/[0.06] overflow-x-auto">
      {STAGES.map((s, i) => {
        const reached = i <= stage;
        const current = i === stage && stage < STAGES.length - 1;
        const isLast  = i === STAGES.length - 1;
        const isFailed = failed && i === stage;

        return (
          <div key={s.label} className="flex items-center">
            <div className={`flex items-center gap-1.5 flex-shrink-0 ${
              isFailed ? "text-red-400" :
              reached  ? (isLast ? "text-emerald-400" : current ? "text-indigo-300" : "text-zinc-300") :
              "text-zinc-700"
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isFailed ? "bg-red-500" :
                reached  ? (isLast ? "bg-emerald-500" : "bg-indigo-500") :
                "bg-zinc-700"
              }`} />
              <span className="text-[10px] font-semibold tracking-widest uppercase whitespace-nowrap">
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-8 sm:w-16 h-px mx-2 flex-shrink-0 ${i < stage ? "bg-indigo-600/50" : "bg-zinc-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultCard({
  execution,
  auditEntry,
  onClose,
}: {
  execution: FixExecution;
  auditEntry: FixAuditEntry;
  onClose: () => void;
}) {
  const success = execution.status === "success";

  return (
    <div className={`mx-6 mb-6 mt-4 rounded-2xl border p-5 ${
      success
        ? "bg-emerald-950/20 border-emerald-500/20"
        : "bg-red-950/20 border-red-500/20"
    }`}>
      <div className="flex items-start gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          success ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`}>
          {success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
        </div>
        <div>
          <p className={`text-sm font-bold ${success ? "text-emerald-300" : "text-red-300"}`}>
            {success ? "Fix Applied Successfully" : "Fix Failed"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {success
              ? "All verifications passed. Issue is now closed."
              : `Failed at: ${auditEntry.failedStepLabel ?? "Unknown step"}`}
          </p>
        </div>
      </div>

      {/* Audit summary grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px] mb-5">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-600 mb-0.5">
            <Hash className="w-3 h-3" /> Audit ID
          </div>
          <code className="font-mono text-zinc-300">{auditEntry.id}</code>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-zinc-600 mb-0.5">
            <Hash className="w-3 h-3" /> Execution ID
          </div>
          <code className="font-mono text-zinc-300">{execution.id}</code>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Issue</p>
          <code className="font-mono text-zinc-300">{auditEntry.issueId}</code>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Patch</p>
          <code className="font-mono text-zinc-300">{auditEntry.patchId}</code>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Applied By</p>
          <span className="text-zinc-300">{auditEntry.appliedBy}</span>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Duration</p>
          <span className="text-zinc-300">
            {(auditEntry.totalDurationMs / 1000).toFixed(1)}s
          </span>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Approved By</p>
          <span className="text-zinc-300">{auditEntry.approvedBy}</span>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Final Status</p>
          <span className={`font-semibold ${success ? "text-emerald-400" : "text-red-400"}`}>
            {auditEntry.finalStatus === "closed" ? "CLOSED" : "FIX FAILED"}
          </span>
        </div>
      </div>

      {!success && auditEntry.errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-900/30">
          <p className="text-[11px] text-red-400 leading-relaxed">{auditEntry.errorMessage}</p>
        </div>
      )}

      <button
        onClick={onClose}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          success
            ? "bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/25"
            : "bg-red-600/15 border border-red-500/25 text-red-300 hover:bg-red-600/25"
        }`}
      >
        {success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {success ? "Done — Close Fix Engine" : "Close Fix Engine"}
      </button>

      {!success && (
        <p className="mt-3 text-[10px] text-zinc-700 italic text-center">
          No rollback available in Phase 13.4. Phase 13.5 provides rollback and version history.
        </p>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface FixEnginePanelProps {
  patch: PatchProposal | null;
  onClose: () => void;
  onFixComplete: (entry: FixAuditEntry, issueId: string) => void;
}

export function FixEnginePanel({ patch, onClose, onFixComplete }: FixEnginePanelProps) {
  const [execution,   setExecution]   = useState<FixExecution | null>(null);
  const [auditEntry,  setAuditEntry]  = useState<FixAuditEntry | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);

  const completedRef = useRef(false);
  const isOpen = patch !== null;
  const isRunning = execution?.status === "running";

  // Auto-start execution when a patch is provided
  useEffect(() => {
    if (!patch) {
      setExecution(null);
      setAuditEntry(null);
      setEngineError(null);
      completedRef.current = false;
      return;
    }

    let cancelled = false;
    completedRef.current = false;
    setEngineError(null);
    setExecution(null);
    setAuditEntry(null);

    fixEngineService.applyFix(
      patch,
      "admin",
      (exec) => {
        if (!cancelled) setExecution(exec);
      },
    ).then(({ execution: finalExec, auditEntry: entry }) => {
      if (cancelled) return;
      setExecution(finalExec);
      setAuditEntry(entry);
      if (!completedRef.current) {
        completedRef.current = true;
        onFixComplete(entry, patch.issueId);
      }
    }).catch((err: unknown) => {
      if (cancelled) return;
      setEngineError(err instanceof Error ? err.message : String(err));
    });

    return () => { cancelled = true; };
  }, [patch?.id]);

  const handleClose = () => {
    if (isRunning) return;
    onClose();
  };

  const stage  = execution ? getStage(execution.steps, execution.status) : 0;
  const failed = execution?.status === "failed";

  // Ordered steps for display
  const steps = execution
    ? STEP_ORDER.map(id => execution.steps.find(s => s.id === id)!).filter(Boolean)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 70 }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`
          fixed flex flex-col
          inset-x-0 bottom-0 top-0
          md:inset-x-auto md:left-1/2 md:-translate-x-1/2
          md:top-1/2 md:-translate-y-1/2
          md:w-[min(90vw,780px)] md:h-[min(90vh,820px)]
          md:rounded-2xl
          bg-[#0c0c10] border border-white/[0.07] shadow-2xl
          transition-all duration-300 ease-out
          ${isOpen ? "opacity-100 translate-y-0 md:scale-100" : "opacity-0 translate-y-8 md:scale-95 pointer-events-none"}
        `}
        style={{ zIndex: 80 }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-zinc-100">Fix Engine</p>
              {patch && (
                <span className="font-mono text-[11px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                  {patch.id}
                </span>
              )}
              {isRunning && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-500/12 text-indigo-400 border-indigo-500/20">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Running
                </span>
              )}
              {execution?.status === "success" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/12 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Complete
                </span>
              )}
              {execution?.status === "failed" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/12 text-red-400 border-red-500/20">
                  <XCircle className="w-2.5 h-2.5" /> Failed
                </span>
              )}
            </div>
            {patch && (
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">{patch.title}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={isRunning}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress bar ── */}
        <ProgressBar stage={stage} failed={failed} />

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Engine error (hard guard failure or unexpected error) */}
          {engineError && (
            <div className="m-6 p-4 rounded-xl bg-red-950/20 border border-red-500/20">
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-300 mb-1">Fix Engine Error</p>
                  <p className="text-[11px] text-red-400 leading-relaxed">{engineError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Initializing */}
          {!execution && !engineError && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mb-4 animate-pulse">
                <Wrench className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-300 mb-1">Initialising Fix Engine…</p>
              <p className="text-xs text-zinc-600">Validating patch and preparing execution pipeline.</p>
            </div>
          )}

          {/* Step timeline */}
          {execution && steps.length > 0 && (
            <div className="p-4 space-y-1">
              {/* Execution meta */}
              <div className="flex items-center gap-4 px-4 py-2 mb-2">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                  <Hash className="w-3 h-3" />
                  <code>{execution.id}</code>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                  <Clock className="w-3 h-3" />
                  {new Date(execution.startedAt).toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                  <Wrench className="w-3 h-3" />
                  {execution.appliedBy}
                </div>
              </div>

              {steps.map(step => <StepRow key={step.id} step={step} />)}
            </div>
          )}

          {/* Result card */}
          {execution && auditEntry && execution.status !== "running" && (
            <ResultCard
              execution={execution}
              auditEntry={auditEntry}
              onClose={handleClose}
            />
          )}
        </div>

        {/* ── Footer warning during execution ── */}
        {isRunning && (
          <div className="flex-shrink-0 border-t border-white/[0.06] px-6 py-3 flex items-center gap-2">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-600">
              Execution in progress — do not close this window.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
