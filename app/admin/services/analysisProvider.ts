/**
 * Analysis Provider — Phase 14.1
 *
 * Replaces SampleIssueProvider with LiveScannerProvider, which calls the
 * real backend scanning API at /api/v1/admin/developer/*.
 *
 * The IssueProvider interface is unchanged. AIDeveloperPage and all Phase 13
 * downstream workflows (Patch → Fix Engine → Rollback) continue unmodified.
 *
 * SAMPLE_ISSUES are no longer the active data source. All issue data now
 * originates from real project filesystem scanning on the backend.
 *
 * Also retains all forward-declared analysis interfaces for Phase 14.2+.
 */

import {
  type DevIssue,
  type ScanRecord,
  type SystemHealthCard,
  type IssueSummary,
  type IssueStatus,
  type IssueVerificationStatus,
  type ScanType,
} from "./developerService";
import type { PatchProposal, PatchHistoryEntry, PatchValidationResult } from "./patchService";

// ─── Phase 14.2 — Analysis Record ────────────────────────────────────────────

export interface AnalysisRecord {
  id:                   string;    // ANA-XXXX
  scanId:               string;
  timestamp:            string;
  filesAnalysed:        number;
  modulesAnalysed:      string[];
  dependenciesAnalysed: number;
  issuesAnalysed:       number;
  durationMs:           number;
  analysisVersion:      string;
  scannerVersion:       string;
  graphNodeCount:       number;
  graphEdgeCount:       number;
}

// ─── IssueProvider interface ──────────────────────────────────────────────────

export interface IssueProviderResult<T> {
  items: T[];
  total: number;
}

/**
 * IssueProvider — the single abstraction between the UI and any data source.
 * Replace activeIssueProvider to connect a live scanner, backend API, or test fixture.
 */
export interface IssueProvider {
  fetchIssueSummary(): Promise<IssueSummary>;
  fetchIssues(): Promise<IssueProviderResult<DevIssue>>;
  fetchScanHistory(): Promise<IssueProviderResult<ScanRecord>>;
  fetchSystemHealth(): Promise<SystemHealthCard[]>;
  fetchIssueById(id: string): Promise<DevIssue | null>;
  updateIssueStatus(
    id: string,
    status: IssueStatus,
    verificationStatus?: IssueVerificationStatus,
  ): Promise<DevIssue>;
  triggerScan(type: ScanType): Promise<void>;
  fetchAnalysisHistory(): Promise<IssueProviderResult<AnalysisRecord>>;
  // Phase 14.3 — Patch Engine
  generatePatch(issueId: string): Promise<PatchProposal | null>;
  fetchPatchByIssueId(issueId: string): Promise<PatchProposal | null>;
  approvePatch(patchId: string, approvedBy: string): Promise<PatchProposal | null>;
  rejectPatch(patchId: string, rejectedBy: string, reason: string): Promise<PatchProposal | null>;
  fetchPatchHistory(): Promise<IssueProviderResult<PatchHistoryEntry>>;
  validatePatch(patchId: string): Promise<PatchValidationResult | null>;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";

function getToken(): string | null {
  return localStorage.getItem("bitzimi_access_token");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json() as { data?: T; error?: { code: string; message: string } };
  if (!res.ok) {
    throw Object.assign(
      new Error((json as { error?: { message?: string } }).error?.message ?? "Developer API error"),
      { status: res.status },
    );
  }
  return (json as { data: T }).data;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── LiveScannerProvider — calls the real backend scanner API ─────────────────

class LiveScannerProvider implements IssueProvider {
  async fetchIssueSummary(): Promise<IssueSummary> {
    return apiFetch<IssueSummary>("/api/v1/admin/developer/summary");
  }

  async fetchIssues(): Promise<IssueProviderResult<DevIssue>> {
    return apiFetch<IssueProviderResult<DevIssue>>("/api/v1/admin/developer/issues");
  }

  async fetchScanHistory(): Promise<IssueProviderResult<ScanRecord>> {
    return apiFetch<IssueProviderResult<ScanRecord>>("/api/v1/admin/developer/scan-history");
  }

  async fetchSystemHealth(): Promise<SystemHealthCard[]> {
    return apiFetch<SystemHealthCard[]>("/api/v1/admin/developer/health");
  }

  async fetchIssueById(id: string): Promise<DevIssue | null> {
    return apiFetch<DevIssue>(`/api/v1/admin/developer/issues/${id}`).catch(() => null);
  }

  async updateIssueStatus(
    id: string,
    status: IssueStatus,
    verificationStatus?: IssueVerificationStatus,
  ): Promise<DevIssue> {
    return apiFetch<DevIssue>(`/api/v1/admin/developer/issues/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(verificationStatus ? { verificationStatus } : {}) }),
    });
  }

  async fetchAnalysisHistory(): Promise<IssueProviderResult<AnalysisRecord>> {
    return apiFetch<IssueProviderResult<AnalysisRecord>>("/api/v1/admin/developer/analysis/history");
  }

  async generatePatch(issueId: string): Promise<PatchProposal | null> {
    return apiFetch<PatchProposal>("/api/v1/admin/developer/patches/generate", {
      method: "POST",
      body: JSON.stringify({ issueId }),
    }).catch(() => null);
  }

  async fetchPatchByIssueId(issueId: string): Promise<PatchProposal | null> {
    return apiFetch<PatchProposal>(
      `/api/v1/admin/developer/patches/by-issue/${issueId}`,
    ).catch(() => null);
  }

  async approvePatch(patchId: string, _approvedBy: string): Promise<PatchProposal | null> {
    return apiFetch<PatchProposal>(
      `/api/v1/admin/developer/patches/${patchId}/approve`,
      { method: "POST", body: JSON.stringify({}) },
    ).catch(() => null);
  }

  async rejectPatch(patchId: string, _rejectedBy: string, reason: string): Promise<PatchProposal | null> {
    return apiFetch<PatchProposal>(
      `/api/v1/admin/developer/patches/${patchId}/reject`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ).catch(() => null);
  }

  async fetchPatchHistory(): Promise<IssueProviderResult<PatchHistoryEntry>> {
    return apiFetch<IssueProviderResult<PatchHistoryEntry>>(
      "/api/v1/admin/developer/patches/history",
    ).catch(() => ({ items: [], total: 0 }));
  }

  async validatePatch(patchId: string): Promise<PatchValidationResult | null> {
    return apiFetch<PatchValidationResult>(
      `/api/v1/admin/developer/patches/${patchId}/validate`,
    ).catch(() => null);
  }

  async triggerScan(type: ScanType): Promise<void> {
    // POST /scan returns a scanId immediately (non-blocking).
    // Poll GET /scan/:scanId until status is "completed" or "failed".
    const started = await apiFetch<{ scanId: string; status: string }>("/api/v1/admin/developer/scan", {
      method: "POST",
      body: JSON.stringify({ type }),
    });

    const { scanId } = started;
    const pollIntervalMs = 1500;
    const maxWaitMs      = 120_000; // 2 min hard cap
    const deadline       = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await delay(pollIntervalMs);
      const progress = await apiFetch<{ status: string; errorMessage: string | null }>(
        `/api/v1/admin/developer/scan/${scanId}`,
      );
      if (progress.status === "completed" || progress.status === "failed") break;
    }
  }
}

/**
 * activeIssueProvider — Phase 14.1: LiveScannerProvider replaces SampleIssueProvider.
 * Issues now originate from real backend filesystem scanning.
 * All downstream Phase 13 workflows (Patch, Fix Engine, Rollback) are unaffected.
 */
export const activeIssueProvider: IssueProvider = new LiveScannerProvider();

// ─── Future analysis interfaces (contracts only — Phase 14+ implements) ────────

export interface DocumentationResult {
  title: string;
  url: string;
  excerpt: string;
  relevanceScore: number;
  source: "official_docs" | "mdn" | "github" | "package_readme";
}

export interface TrustedResourceResult {
  title: string;
  url: string;
  content: string;
  trust: "high" | "medium" | "low";
}

export interface GitHubIssueResult {
  title: string;
  url: string;
  state: "open" | "closed";
  body: string;
}

export interface GitHubCodeResult {
  path: string;
  repository: string;
  url: string;
  content: string;
}

/** Scans actual project files to surface issues. Phase 14 implements. */
export interface ProjectScanner {
  scanProject(type: ScanType): Promise<DevIssue[]>;
  scanFile(filePath: string): Promise<DevIssue[]>;
  scanDirectory(dirPath: string): Promise<DevIssue[]>;
}

/** Searches official framework and library documentation. Phase 14 implements. */
export interface DocumentationSearch {
  search(query: string, framework?: string): Promise<DocumentationResult[]>;
  searchMdn(query: string): Promise<DocumentationResult[]>;
  searchPackageReadme(packageName: string): Promise<DocumentationResult[]>;
}

/** Searches trusted public resources for known issues and patterns. Phase 14 implements. */
export interface TrustedResourceSearch {
  search(query: string): Promise<TrustedResourceResult[]>;
}

/** Searches GitHub for related issues and code patterns. Phase 14 implements. */
export interface GitHubSearch {
  searchIssues(query: string, repo?: string): Promise<GitHubIssueResult[]>;
  searchCode(query: string): Promise<GitHubCodeResult[]>;
}

/** AI orchestrator that synthesises analysis results into fixes. Phase 14 implements. */
export interface AIOrchestrator {
  analyzeIssue(issue: DevIssue): Promise<string>;
  generatePatch(issue: DevIssue, context: string): Promise<string>;
  explainFix(patchDiff: string): Promise<string>;
  assessRisk(patchDiff: string): Promise<Record<string, unknown>>;
}

/** Analyses backend routes, middleware, and services. Phase 14 implements. */
export interface BackendAnalyzer {
  analyzeRoute(routePath: string): Promise<DevIssue[]>;
  analyzeMiddleware(name: string): Promise<DevIssue[]>;
  analyzeService(name: string): Promise<DevIssue[]>;
}

/** Analyses frontend components, routes, and bundle. Phase 14 implements. */
export interface FrontendAnalyzer {
  analyzeComponent(componentPath: string): Promise<DevIssue[]>;
  analyzeRoutes(): Promise<DevIssue[]>;
  analyzeBundleSize(): Promise<DevIssue[]>;
}

/** Analyses database schema, queries, and migrations. Phase 14 implements. */
export interface DatabaseAnalyzer {
  analyzeSchema(): Promise<DevIssue[]>;
  analyzeQueries(): Promise<DevIssue[]>;
  analyzeMigrations(): Promise<DevIssue[]>;
}

/** Analyses API endpoints, auth flows, and rate limits. Phase 14 implements. */
export interface APIAnalyzer {
  analyzeEndpoint(path: string, method: string): Promise<DevIssue[]>;
  analyzeAuthFlow(): Promise<DevIssue[]>;
  analyzeRateLimits(): Promise<DevIssue[]>;
}

/** Analyses npm dependencies for vulnerabilities and outdated packages. Phase 14 implements. */
export interface DependencyAnalyzer {
  analyzeVulnerabilities(): Promise<DevIssue[]>;
  analyzeOutdated(): Promise<DevIssue[]>;
  analyzeLicenses(): Promise<DevIssue[]>;
}

/** Analyses build output, TypeScript errors, and lint warnings. Phase 14 implements. */
export interface BuildAnalyzer {
  analyzeBuildOutput(): Promise<DevIssue[]>;
  analyzeTypeErrors(): Promise<DevIssue[]>;
  analyzeLintWarnings(): Promise<DevIssue[]>;
}

/** Post-fix verification engine. Phase 14 implements. */
export interface VerificationEngine {
  verifyFrontend(): Promise<boolean>;
  verifyBackend(): Promise<boolean>;
  verifyDatabase(): Promise<boolean>;
  verifyApis(): Promise<boolean>;
  verifyIntegrations(): Promise<boolean>;
}
