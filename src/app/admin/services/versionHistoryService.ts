/**
 * Version History Service — Phase 13.5
 *
 * Records a complete timeline of events for every issue that passes through
 * the AI Developer Center pipeline: detected → patched → approved → fixed →
 * rolled back → closed.
 *
 * All history is session-scoped in-memory.
 * Phase 14 persists via PersistenceRegistry.versionHistory.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VersionEventType =
  | "issue_detected"
  | "issue_status_changed"
  | "patch_generated"
  | "patch_reviewed"
  | "patch_approved"
  | "patch_rejected"
  | "fix_initiated"
  | "fix_applied"
  | "fix_failed"
  | "snapshot_created"
  | "rollback_initiated"
  | "rollback_complete"
  | "rollback_failed"
  | "issue_closed"
  | "issue_reopened";

export type VersionEntryStatus = "active" | "superseded" | "rolled_back";

export interface VersionEntry {
  id: string;                    // VER-XXXX
  versionNumber: number;         // monotonic per issue
  issueId: string;
  patchId: string | null;
  snapshotId: string | null;
  auditId: string | null;
  executionId: string | null;
  rollbackId: string | null;
  event: VersionEventType;
  summary: string;
  createdAt: string;
  createdBy: string;
  status: VersionEntryStatus;
}

// ─── Session-scoped store ─────────────────────────────────────────────────────

// key: issueId → chronological list of VersionEntry
const historyStore = new Map<string, VersionEntry[]>();
const issueVersionCounters = new Map<string, number>();
let globalCounter = 0;

function padId(n: number): string {
  return `VER-${String(n).padStart(4, "0")}`;
}

// ─── Params type ──────────────────────────────────────────────────────────────

export interface RecordEventParams {
  issueId: string;
  event: VersionEventType;
  summary: string;
  patchId?: string | null;
  snapshotId?: string | null;
  auditId?: string | null;
  executionId?: string | null;
  rollbackId?: string | null;
  createdBy?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const versionHistoryService = {
  recordEvent(params: RecordEventParams): VersionEntry {
    globalCounter++;
    const vNum = (issueVersionCounters.get(params.issueId) ?? 0) + 1;
    issueVersionCounters.set(params.issueId, vNum);

    const entry: VersionEntry = {
      id: padId(globalCounter),
      versionNumber: vNum,
      issueId: params.issueId,
      patchId: params.patchId ?? null,
      snapshotId: params.snapshotId ?? null,
      auditId: params.auditId ?? null,
      executionId: params.executionId ?? null,
      rollbackId: params.rollbackId ?? null,
      event: params.event,
      summary: params.summary,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy ?? "admin",
      status: "active",
    };

    const existing = historyStore.get(params.issueId) ?? [];
    historyStore.set(params.issueId, [...existing, entry]);
    return entry;
  },

  /** Returns history for one issue, newest first. */
  getHistory(issueId: string): VersionEntry[] {
    return [...(historyStore.get(issueId) ?? [])].reverse();
  },

  /** Returns all history across all issues, newest first. */
  getAllHistory(): VersionEntry[] {
    const all: VersionEntry[] = [];
    for (const entries of historyStore.values()) {
      all.push(...entries);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getEntry(id: string): VersionEntry | null {
    for (const entries of historyStore.values()) {
      const found = entries.find(e => e.id === id);
      if (found) return found;
    }
    return null;
  },

  /** Returns the IDs of all issues that have any history recorded. */
  getTrackedIssueIds(): string[] {
    return [...historyStore.keys()];
  },
};
