/**
 * RollbackPanel — Phase 13.5
 *
 * Centered modal that runs the rollback execution pipeline for a given
 * ProjectSnapshot. Mirrors FixEnginePanel in structure and interaction model.
 *
 * HARD RULES mirrored from rollbackService:
 * ─ Only snapshots with status === "active" can initiate a rollback.
 * ─ Close is disabled during execution.
 * ─ NO filesystem writes. NO Git operations. NO project source file changes.
 * ─ All steps are simulated exactly like the Fix Engine.
 *
 * Z-index: backdrop style zIndex:90 / modal style zIndex:100
 * (above FixEnginePanel at 70/80)
 */

import { useEffect, useRef, useState } from "react";
import {
  X, CheckCircle2, XCircle, Minus as MinusIcon, RotateCcw,
  ShieldCheck, Wrench, Globe, Server, Database, Activity,
  AlertOctagon, Clock, RefreshCw, Camera, Hash,
} from "lucide-react";
import {
  rollbackService,
  ROLLBACK_STEP_ORDER,
  type RollbackAuditEntry,
  type RollbackExecution,
  type RollbackStep,
  type RollbackStepId,
  type RollbackStepStatus,
} from "../../services/rollbackService";
import type { ProjectSnapshot } from "../../services/snapshotService";

// ─── Step system icons ────────────────────────────────────────────────────────

const STEP_ICONS: Partial<Record<RollbackStepId, React.ElementType>> = {
  validate_snapshot:   ShieldCheck,
  restore_issue_state: RotateCcw,
  restore_patch_state: Wrench,
  verify_frontend:     Globe,
  verify_backend:      Server,
  verify_database:     Database,
  verify_apis:         Activity,
  record_rollback:     Camera,
};

// ─── Progress stages ──────────────────────────────────────────────────────────

const STAGES = [
  { label: "SNAPSHOT",      steps: [] as RollbackStepId[] },
  { label: "STATE RESTORED", steps: ["validate_snapshot", "restore_issue_state", "restore_patch_state"] as RollbackStepId[] },
  { label: "VERIFIED",      steps: ["verify_frontend", "verify_backend", "verify_database", "verify_apis"] as RollbackStepId[] },
  { label: "ROLLED BACK",   steps: [] as RollbackStepId[] },
];

function getStage(steps: RollbackStep[], execStatus: string): number {
  if (execStatus === "success") return 3;
  if (execStatus === "failed")  return 1;
  if (execStatus === "idle")    return 0;
  const restoreDone = steps.find(s => s.id === "restore_patch_state")?.status === "success";
  const anyVerify   = steps.some(s => s.id.startsWith("verify_") && (s.status === "running" || s.status === "success"));
  if (anyVerify || restoreDone) return 2;
  return 1;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: RollbackStepStatus }) {
  switch (status) {
    case "running": return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
    case "success": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "failed":  return <XCircle className="w-4 h-4 text-red-400" />;
    case "skipped": return <MinusIcon className="w-4 h-4 text-zinc-600" />;
    default:        return <div className="w-2 h-2 rounded-full bg-zinc-700 mx-1" />;
  }
}

function StepRow({ step }: { step: RollbackStep }) {
  const SysIcon = STEP_ICONS[step.id] ?? Activity;
  const isRunning = step.status === "running";
  const isFailed  = step.status === "failed";
  const isSkipped = step.status === "skipped";

  return (
    <div className={`flex items-start gap-3 py-3 px-4 rounded-xl transition-colors ${
      isRunning ? "bg-amber-500/8 border border-amber-500/20" :
      isFailed  ? "bg-red-500/8 border border-red-500/15" :
      isSkipped ? "opacity-40" :
      "bg-transparent"
    }`}>
      <div className="flex-shrink-0 mt-0.5 w-5 flex items-center justify-center">
        <StepStatusIcon status={step.status} />
      </div>
      <div className={`flex-shrink-0 mt-0.5 ${
        isRunning ? "text-amber-500" :
        isFailed  ? "text-red-500" :
        step.status === "success" ? "text-emerald-600" :
        "text-zinc-700"
      }`}>
        <SysIcon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${
            isRunning ? "text-amber-200" :
            isFailed  ? "text-red-300" :
            step.status === "success" ? "text-zinc-200" :
            isSkipped ? "text-zinc-600" :
            "text-zinc-500"
          }`}>
            {step.label}
            {isRunning && <span className="ml-1 text-amber-400 text-xs animate-pulse">…</span>}
          </span>
          {step.durationMs !== null && step.status !== "skipped" && (
            <span className="text-[10px] text-zinc-600 tabular-nums">
              {step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`}
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
      </div>
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
        const reached  = i <= stage;
        const current  = i === stage && stage < STAGES.length - 1;
        const isLast   = i === STAGES.length - 1;
        const isFailed = failed && i === stage;
        return (
          <div key={s.label} className="flex items-center">
            <div className={`flex items-center gap-1.5 flex-shrink-0 ${
              isFailed ? "text-red-400" :
              reached  ? (isLast ? "text-emerald-400" : current ? "text-amber-300" : "text-zinc-300") :
              "text-zinc-700"
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isFailed ? "bg-red-500" :
                reached  ? (isLast ? "bg-emerald-500" : "bg-amber-500") :
                "bg-zinc-700"
              }`} />
              <span className="text-[10px] font-semibold tracking-widest uppercase whitespace-nowrap">
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-8 sm:w-14 h-px mx-2 flex-shrink-0 ${i < stage ? "bg-amber-600/40" : "bg-zinc-800"}`} />
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
  snapshot,
  onClose,
}: {
  execution: RollbackExecution;
  auditEntry: RollbackAuditEntry;
  snapshot: ProjectSnapshot;
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
          {success ? <RotateCcw className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
        </div>
        <div>
          <p className={`text-sm font-bold ${success ? "text-emerald-300" : "text-red-300"}`}>
            {success ? "Rollback Complete" : "Rollback Failed"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {success
              ? `Issue ${snapshot.issueId} restored to pre-fix state.`
              : `Failed at: ${auditEntry.failedStepLabel ?? "Unknown step"}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px] mb-5">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-600 mb-0.5">
            <Hash className="w-3 h-3" /> Rollback ID
          </div>
          <code className="font-mono text-zinc-300">{auditEntry.id}</code>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-zinc-600 mb-0.5">
            <Camera className="w-3 h-3" /> Snapshot
          </div>
          <code className="font-mono text-zinc-300">{auditEntry.snapshotId}</code>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Issue</p>
          <code className="font-mono text-zinc-300">{auditEntry.issueId}</code>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Patch</p>
          <code className="font-mono text-zinc-300">{auditEntry.patchId}</code>
        </div>
        {success && (
          <>
            <div>
              <p className="text-zinc-600 mb-0.5">Restored Status</p>
              <span className="text-zinc-300 capitalize">{auditEntry.restoredStatus.replace(/_/g, " ")}</span>
            </div>
            <div>
              <p className="text-zinc-600 mb-0.5">Duration</p>
              <span className="text-zinc-300">{(auditEntry.totalDurationMs / 1000).toFixed(1)}s</span>
            </div>
          </>
        )}
        <div>
          <p className="text-zinc-600 mb-0.5">Initiated By</p>
          <span className="text-zinc-300">{auditEntry.initiatedBy}</span>
        </div>
        <div>
          <p className="text-zinc-600 mb-0.5">Final Status</p>
          <span className={`font-semibold ${success ? "text-emerald-400" : "text-red-400"}`}>
            {success ? "ROLLED BACK" : "ROLLBACK FAILED"}
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
        {success ? "Done — Close Rollback Engine" : "Close Rollback Engine"}
      </button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface RollbackPanelProps {
  snapshot: ProjectSnapshot | null;
  onClose: () => void;
  onRollbackComplete: (entry: RollbackAuditEntry, snapshot: ProjectSnapshot) => void;
}

export function RollbackPanel({ snapshot, onClose, onRollbackComplete }: RollbackPanelProps) {
  const [execution,    setExecution]    = useState<RollbackExecution | null>(null);
  const [auditEntry,   setAuditEntry]   = useState<RollbackAuditEntry | null>(null);
  const [engineError,  setEngineError]  = useState<string | null>(null);

  const completedRef = useRef(false);
  const isOpen       = snapshot !== null;
  const isRunning    = execution?.status === "running";

  useEffect(() => {
    if (!snapshot) {
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

    rollbackService.executeRollback(
      snapshot,
      "admin",
      (exec) => { if (!cancelled) setExecution(exec); },
    ).then(({ execution: finalExec, auditEntry: entry }) => {
      if (cancelled) return;
      setExecution(finalExec);
      setAuditEntry(entry);
      if (!completedRef.current) {
        completedRef.current = true;
        onRollbackComplete(entry, snapshot);
      }
    }).catch((err: unknown) => {
      if (cancelled) return;
      setEngineError(err instanceof Error ? err.message : String(err));
    });

    return () => { cancelled = true; };
  }, [snapshot?.id]);

  const handleClose = () => {
    if (isRunning) return;
    onClose();
  };

  const stage  = execution ? getStage(execution.steps, execution.status) : 0;
  const failed = execution?.status === "failed";

  const steps = execution
    ? ROLLBACK_STEP_ORDER.map(id => execution.steps.find(s => s.id === id)!).filter(Boolean)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 90 }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`
          fixed flex flex-col
          inset-x-0 bottom-0 top-0
          md:inset-x-auto md:left-1/2 md:-translate-x-1/2
          md:top-1/2 md:-translate-y-1/2
          md:w-[min(90vw,760px)] md:h-[min(90vh,800px)]
          md:rounded-2xl
          bg-[#0c0c10] border border-white/[0.07] shadow-2xl
          transition-all duration-300 ease-out
          ${isOpen ? "opacity-100 translate-y-0 md:scale-100" : "opacity-0 translate-y-8 md:scale-95 pointer-events-none"}
        `}
        style={{ zIndex: 100 }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-zinc-100">Rollback Engine</p>
              {snapshot && (
                <span className="font-mono text-[11px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                  {snapshot.id}
                </span>
              )}
              {isRunning && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/12 text-amber-400 border-amber-500/20">
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
            {snapshot && (
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                Restoring {snapshot.issueId} → {snapshot.patchId} — captured {new Date(snapshot.capturedAt).toLocaleString()}
              </p>
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

          {engineError && (
            <div className="m-6 p-4 rounded-xl bg-red-950/20 border border-red-500/20">
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-300 mb-1">Rollback Engine Error</p>
                  <p className="text-[11px] text-red-400 leading-relaxed">{engineError}</p>
                </div>
              </div>
            </div>
          )}

          {!execution && !engineError && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mb-4 animate-pulse">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-300 mb-1">Initialising Rollback Engine…</p>
              <p className="text-xs text-zinc-600">Validating snapshot and preparing restoration pipeline.</p>
            </div>
          )}

          {execution && steps.length > 0 && (
            <div className="p-4 space-y-1">
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
                  <RotateCcw className="w-3 h-3" />
                  {execution.initiatedBy}
                </div>
              </div>
              {steps.map(step => <StepRow key={step.id} step={step} />)}
            </div>
          )}

          {execution && auditEntry && snapshot && execution.status !== "running" && (
            <ResultCard
              execution={execution}
              auditEntry={auditEntry}
              snapshot={snapshot}
              onClose={handleClose}
            />
          )}
        </div>

        {/* ── Footer warning during execution ── */}
        {isRunning && (
          <div className="flex-shrink-0 border-t border-white/[0.06] px-6 py-3 flex items-center gap-2">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-600">
              Rollback in progress — do not close this window.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
