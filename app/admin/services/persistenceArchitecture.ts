/**
 * Persistence Architecture — Phase 13.5
 *
 * Declares the backend persistence contracts for every entity managed by the
 * AI Developer Center. These are forward-declarations only.
 *
 * NO Prisma. NO SQLite. NO migrations. NO network calls.
 * Phase 14 provides concrete implementations of each interface and wires
 * them into a PersistenceRegistry that replaces the current in-memory stores.
 */

import type { DevIssue, ScanRecord } from "./developerService";
import type { PatchProposal } from "./patchService";
import type { FixExecution, FixAuditEntry } from "./fixEngineService";
import type { ProjectSnapshot } from "./snapshotService";
import type { VersionEntry } from "./versionHistoryService";
import type { RollbackExecution, RollbackAuditEntry } from "./rollbackService";

// ─── Shared pagination ────────────────────────────────────────────────────────

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Persistence interfaces ───────────────────────────────────────────────────

export interface IssueHistoryPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<DevIssue>>;
  findById(id: string): Promise<DevIssue | null>;
  findByStatus(status: string, opts?: PaginationOptions): Promise<PaginatedResult<DevIssue>>;
  create(issue: DevIssue): Promise<DevIssue>;
  update(id: string, patch: Partial<DevIssue>): Promise<DevIssue>;
  count(): Promise<number>;
}

export interface PatchHistoryPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<PatchProposal>>;
  findById(id: string): Promise<PatchProposal | null>;
  findByIssueId(issueId: string): Promise<PatchProposal[]>;
  create(patch: PatchProposal): Promise<PatchProposal>;
  update(id: string, patch: Partial<PatchProposal>): Promise<PatchProposal>;
}

export interface SnapshotPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<ProjectSnapshot>>;
  findById(id: string): Promise<ProjectSnapshot | null>;
  findByIssueId(issueId: string): Promise<ProjectSnapshot[]>;
  findActive(issueId: string): Promise<ProjectSnapshot | null>;
  create(snapshot: ProjectSnapshot): Promise<ProjectSnapshot>;
  markRestored(id: string): Promise<ProjectSnapshot>;
  markSuperseded(issueId: string): Promise<void>;
}

export interface ExecutionPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<FixExecution>>;
  findById(id: string): Promise<FixExecution | null>;
  findByIssueId(issueId: string): Promise<FixExecution[]>;
  create(execution: FixExecution): Promise<FixExecution>;
}

export interface FixAuditPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<FixAuditEntry>>;
  findById(id: string): Promise<FixAuditEntry | null>;
  findByIssueId(issueId: string): Promise<FixAuditEntry[]>;
  create(entry: FixAuditEntry): Promise<FixAuditEntry>;
}

export interface VersionHistoryPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<VersionEntry>>;
  findById(id: string): Promise<VersionEntry | null>;
  findByIssueId(issueId: string): Promise<VersionEntry[]>;
  getTrackedIssueIds(): Promise<string[]>;
  create(entry: VersionEntry): Promise<VersionEntry>;
}

export interface ScanPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<ScanRecord>>;
  findById(id: string): Promise<ScanRecord | null>;
  findByType(type: string): Promise<ScanRecord[]>;
  create(scan: ScanRecord): Promise<ScanRecord>;
  update(id: string, patch: Partial<ScanRecord>): Promise<ScanRecord>;
}

export interface RollbackExecutionPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<RollbackExecution>>;
  findById(id: string): Promise<RollbackExecution | null>;
  findByIssueId(issueId: string): Promise<RollbackExecution[]>;
  create(exec: RollbackExecution): Promise<RollbackExecution>;
}

export interface RollbackAuditPersistence {
  findAll(opts?: PaginationOptions): Promise<PaginatedResult<RollbackAuditEntry>>;
  findById(id: string): Promise<RollbackAuditEntry | null>;
  findByIssueId(issueId: string): Promise<RollbackAuditEntry[]>;
  findBySnapshotId(snapshotId: string): Promise<RollbackAuditEntry[]>;
  create(entry: RollbackAuditEntry): Promise<RollbackAuditEntry>;
}

// ─── Persistence registry ─────────────────────────────────────────────────────
// Phase 14: provide a concrete PersistenceRegistry implementation and inject it
// into the AI Developer Center. All in-memory stores are then replaced.

export interface PersistenceRegistry {
  issues:             IssueHistoryPersistence;
  patches:            PatchHistoryPersistence;
  snapshots:          SnapshotPersistence;
  executions:         ExecutionPersistence;
  fixAudits:          FixAuditPersistence;
  versions:           VersionHistoryPersistence;
  scans:              ScanPersistence;
  rollbackExecutions: RollbackExecutionPersistence;
  rollbackAudits:     RollbackAuditPersistence;
}
