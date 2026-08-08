/**
 * Snapshot Service — Phase 13.5
 *
 * Captures project state immediately before a fix is applied.
 * All snapshots are in-memory (session-scoped).
 *
 * HARD RULES:
 * ─ NO filesystem writes. NO Git operations. NO project file modifications.
 * ─ Snapshots are read-only records of state at a point in time.
 * ─ Phase 14 wires these to the backend persistence layer.
 */

import type { PatchProposal, PatchApprovalStatus, PatchRiskLevel, PatchComplexity } from "./patchService";
import type { DevIssue, IssueStatus, IssueVerificationStatus } from "./developerService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SnapshotReason = "pre_fix" | "manual";
export type SnapshotStatus = "active" | "restored" | "superseded";

export interface IssueStateSnapshot {
  status: IssueStatus;
  verificationStatus: IssueVerificationStatus;
  updatedAt: string;
}

export interface PatchStateSnapshot {
  approvalStatus: PatchApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface SnapshotFile {
  filePath: string;
  language: string;
  linesTotal: number;
}

export interface SnapshotMetadata {
  platform: string;
  totalFilesAffected: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  riskLevel: PatchRiskLevel;
  complexity: PatchComplexity;
}

export interface ProjectSnapshot {
  id: string;                          // SNAP-XXXX
  issueId: string;
  patchId: string;
  capturedAt: string;
  capturedBy: string;
  reason: SnapshotReason;
  status: SnapshotStatus;
  affectedFiles: SnapshotFile[];
  issueStateBefore: IssueStateSnapshot;
  patchStateBefore: PatchStateSnapshot;
  metadata: SnapshotMetadata;
}

// ─── Session-scoped store ─────────────────────────────────────────────────────

const snapshotStore = new Map<string, ProjectSnapshot>();
let counter = 0;

function padId(n: number): string {
  return `SNAP-${String(n).padStart(4, "0")}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const snapshotService = {
  /**
   * captureSnapshot — records the state of an issue and its associated patch
   * immediately before the Fix Engine is invoked.
   *
   * NO filesystem writes. The snapshot is purely an in-memory state record.
   */
  captureSnapshot(
    patch: PatchProposal,
    issue: DevIssue,
    capturedBy = "admin",
  ): ProjectSnapshot {
    counter++;
    const snapshot: ProjectSnapshot = {
      id: padId(counter),
      issueId: issue.id,
      patchId: patch.id,
      capturedAt: new Date().toISOString(),
      capturedBy,
      reason: "pre_fix",
      status: "active",
      affectedFiles: patch.files.map(f => ({
        filePath: f.filePath,
        language: f.language,
        linesTotal: f.lines.length,
      })),
      issueStateBefore: {
        status: issue.status,
        verificationStatus: issue.verificationStatus,
        updatedAt: issue.updatedAt,
      },
      patchStateBefore: {
        approvalStatus: patch.approvalStatus,
        approvedBy: patch.approvedBy ?? null,
        approvedAt: patch.approvedAt ?? null,
      },
      metadata: {
        platform: "BitZimi Platform",
        totalFilesAffected: patch.totalFilesAffected,
        totalLinesAdded: patch.totalLinesAdded,
        totalLinesRemoved: patch.totalLinesRemoved,
        riskLevel: patch.riskAssessment.overallRisk,
        complexity: patch.complexity,
      },
    };
    snapshotStore.set(snapshot.id, snapshot);
    return snapshot;
  },

  getSnapshot(id: string): ProjectSnapshot | null {
    return snapshotStore.get(id) ?? null;
  },

  listSnapshots(issueId?: string): ProjectSnapshot[] {
    const all = [...snapshotStore.values()].reverse();
    return issueId ? all.filter(s => s.issueId === issueId) : all;
  },

  markRestored(id: string): void {
    const snap = snapshotStore.get(id);
    if (snap) snap.status = "restored";
  },

  markSuperseded(issueId: string): void {
    for (const snap of snapshotStore.values()) {
      if (snap.issueId === issueId && snap.status === "active") {
        snap.status = "superseded";
      }
    }
  },
};
