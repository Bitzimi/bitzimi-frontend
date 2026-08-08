/**
 * VersionHistoryPanel — Phase 13.5
 *
 * Right-side slide-over panel showing the complete version history for a
 * given issue. Each event in the timeline corresponds to a VersionEntry
 * recorded by versionHistoryService.
 *
 * ─ Z-index: backdrop style zIndex:40, panel style zIndex:50
 *   (same layer as IssueDetailPanel; the two are mutually exclusive)
 * ─ Rollback button appears only for entries whose snapshot is still "active".
 * ─ NO code modifications. NO filesystem writes.
 */

import { useState, useEffect } from "react";
import {
  X, AlertCircle, Zap, ShieldCheck, ShieldAlert, Wrench,
  CheckCircle2, XCircle, Camera, RotateCcw, Clock,
  Tag, Activity, GitBranch,
} from "lucide-react";
import {
  versionHistoryService,
  type VersionEntry,
  type VersionEventType,
} from "../../services/versionHistoryService";
import { snapshotService, type ProjectSnapshot } from "../../services/snapshotService";

// ─── Event display config ─────────────────────────────────────────────────────

interface EventConfig {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
}

const EVENT_CONFIG: Record<VersionEventType, EventConfig> = {
  issue_detected:      { icon: AlertCircle,  color: "text-red-400",     bg: "bg-red-500/10",     label: "Issue Detected" },
  issue_status_changed:{ icon: Tag,          color: "text-zinc-400",    bg: "bg-zinc-700/40",    label: "Status Changed" },
  patch_generated:     { icon: Zap,          color: "text-indigo-400",  bg: "bg-indigo-500/10",  label: "Patch Generated" },
  patch_reviewed:      { icon: Activity,     color: "text-blue-400",    bg: "bg-blue-500/10",    label: "Patch Reviewed" },
  patch_approved:      { icon: ShieldCheck,  color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Patch Approved" },
  patch_rejected:      { icon: ShieldAlert,  color: "text-red-400",     bg: "bg-red-500/10",     label: "Patch Rejected" },
  fix_initiated:       { icon: Wrench,       color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Fix Initiated" },
  fix_applied:         { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Fix Applied" },
  fix_failed:          { icon: XCircle,      color: "text-red-400",     bg: "bg-red-500/10",     label: "Fix Failed" },
  snapshot_created:    { icon: Camera,       color: "text-violet-400",  bg: "bg-violet-500/10",  label: "Snapshot Created" },
  rollback_initiated:  { icon: RotateCcw,    color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Rollback Initiated" },
  rollback_complete:   { icon: RotateCcw,    color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Rollback Complete" },
  rollback_failed:     { icon: RotateCcw,    color: "text-red-400",     bg: "bg-red-500/10",     label: "Rollback Failed" },
  issue_closed:        { icon: CheckCircle2, color: "text-blue-400",    bg: "bg-blue-500/10",    label: "Issue Closed" },
  issue_reopened:      { icon: GitBranch,    color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Issue Reopened" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventRow({
  entry,
  snapshot,
  onRollback,
}: {
  entry: VersionEntry;
  snapshot: ProjectSnapshot | null;
  onRollback: (snap: ProjectSnapshot) => void;
}) {
  const cfg = EVENT_CONFIG[entry.event] ?? EVENT_CONFIG.issue_status_changed;
  const Icon = cfg.icon;
  const canRollback = snapshot !== null && snapshot.status === "active";

  return (
    <div className="flex gap-3">
      {/* Timeline dot + vertical line */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <div className="w-px flex-1 bg-zinc-800 mt-1.5 mb-0" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-5 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[10px] text-zinc-600 ml-2 font-mono">v{entry.versionNumber}</span>
          </div>
          <span className="text-[10px] text-zinc-600 whitespace-nowrap flex-shrink-0">
            {new Date(entry.createdAt).toLocaleTimeString()}
          </span>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">{entry.summary}</p>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {entry.patchId && (
            <span className="font-mono text-[10px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">
              {entry.patchId}
            </span>
          )}
          {entry.snapshotId && (
            <span className="font-mono text-[10px] text-violet-500 bg-violet-500/8 border border-violet-500/15 px-1.5 py-0.5 rounded">
              {entry.snapshotId}
            </span>
          )}
          {entry.auditId && (
            <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded">
              {entry.auditId}
            </span>
          )}
          <span className="text-[10px] text-zinc-600 px-1.5 py-0.5">
            by {entry.createdBy}
          </span>
        </div>

        {/* Snapshot status + rollback trigger */}
        {snapshot && (
          <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[11px] ${
            snapshot.status === "active"
              ? "border-violet-500/20 bg-violet-500/6"
              : snapshot.status === "restored"
              ? "border-emerald-500/15 bg-emerald-500/5"
              : "border-zinc-700/50 bg-zinc-800/30"
          }`}>
            <div className="flex items-center gap-1.5">
              <Camera className={`w-3 h-3 flex-shrink-0 ${
                snapshot.status === "active" ? "text-violet-400" :
                snapshot.status === "restored" ? "text-emerald-400" : "text-zinc-600"
              }`} />
              <span className={
                snapshot.status === "active" ? "text-violet-400" :
                snapshot.status === "restored" ? "text-emerald-400" : "text-zinc-600"
              }>
                Snapshot {snapshot.id} — {snapshot.status}
              </span>
            </div>
            {canRollback && (
              <button
                onClick={() => onRollback(snapshot)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/12 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Roll Back
              </button>
            )}
            {snapshot.status === "restored" && (
              <span className="text-[10px] text-emerald-600">Restored</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface VersionHistoryPanelProps {
  issueId: string | null;
  onClose: () => void;
  onRollback: (snapshot: ProjectSnapshot) => void;
}

export function VersionHistoryPanel({ issueId, onClose, onRollback }: VersionHistoryPanelProps) {
  const [history, setHistory] = useState<VersionEntry[]>([]);

  const isOpen = issueId !== null;

  // Re-load history whenever panel opens or issueId changes
  useEffect(() => {
    if (!issueId) { setHistory([]); return; }
    setHistory(versionHistoryService.getHistory(issueId));
  }, [issueId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 40 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full max-w-lg
          bg-[#0c0c10] border-l border-white/[0.07] shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        style={{ zIndex: 50 }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 border-b border-white/[0.06] px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/12 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100">Version History</p>
            {issueId && (
              <p className="text-[11px] text-zinc-500 font-mono">{issueId}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-sm font-semibold text-zinc-400 mb-1">No history yet</p>
              <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">
                Version entries are recorded as the issue moves through the pipeline: patch generation,
                approval, fix execution, and rollback.
              </p>
            </div>
          ) : (
            <div className="p-5 pt-6">
              {/* Count badge */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] text-zinc-500">{history.length} event{history.length !== 1 ? "s" : ""} recorded</span>
                <span className="text-[10px] font-mono text-zinc-600">newest first</span>
              </div>

              {/* Timeline */}
              <div>
                {history.map(entry => {
                  const snap = entry.snapshotId
                    ? snapshotService.getSnapshot(entry.snapshotId)
                    : null;
                  return (
                    <EventRow
                      key={entry.id}
                      entry={entry}
                      snapshot={snap}
                      onRollback={(s) => {
                        onClose();
                        onRollback(s);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t border-white/[0.06] px-5 py-3">
          <p className="text-[10px] text-zinc-700 text-center">
            Version history is session-scoped. Phase 14 persists to the backend database.
          </p>
        </div>
      </div>
    </>
  );
}
