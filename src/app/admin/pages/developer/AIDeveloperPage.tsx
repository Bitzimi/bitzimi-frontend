import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BrainCircuit, Activity, Server, Database, Globe, Zap, HardDrive,
  Hammer, AlertCircle, AlertTriangle, Info, CheckCircle2, Clock,
  ScanLine, RefreshCw, ChevronDown, Search, X, Filter,
  CalendarDays, Layers, Tag, ShieldAlert, RotateCcw, FileWarning,
  ClipboardList, Minus, Camera, History,
} from "lucide-react";
import { PageHeader }   from "../../components/ui/PageHeader";
import { SectionCard }  from "../../components/ui/SectionCard";
import { StatCard }     from "../../components/ui/StatCard";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { EmptyState }   from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import { IssueDetailPanel }    from "./IssueDetailPanel";
import { PatchPanel }          from "./PatchPanel";
import { FixEnginePanel }      from "./FixEnginePanel";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { RollbackPanel }       from "./RollbackPanel";
import type { PatchProposal }  from "../../services/patchService";
import type { FixAuditEntry }  from "../../services/fixEngineService";
import { snapshotService, type ProjectSnapshot } from "../../services/snapshotService";
import { versionHistoryService } from "../../services/versionHistoryService";
import type { RollbackAuditEntry } from "../../services/rollbackService";
// Phase 13.5: all data fetching goes through activeIssueProvider, not developerService directly.
import { activeIssueProvider, type AnalysisRecord } from "../../services/analysisProvider";
import {
  type DevIssue,
  type ScanRecord,
  type SystemHealthCard,
  type IssueSeverity,
  type IssueLayer,
  type IssueStatus,
  type IssueCategory,
  type IssueVerificationStatus,
  type ScanType,
  type IssueSummary,
} from "../../services/developerService";

// ─── Types ────────────────────────────────────────────────────────────────────

type SeverityFilter     = "all" | IssueSeverity;
type LayerFilter        = "all" | IssueLayer;
type StatusFilter       = "all" | IssueStatus;
type CategoryFilter     = "all" | IssueCategory;
type VerificationFilter = "all" | IssueVerificationStatus;

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<IssueSeverity, { label: string; classes: string; dot: string; icon: React.ElementType }> = {
  critical:      { label: "Critical",      classes: "bg-red-500/12 text-red-400 border-red-500/20",          dot: "bg-red-500",    icon: AlertCircle },
  high:          { label: "High",          classes: "bg-orange-500/12 text-orange-400 border-orange-500/20", dot: "bg-orange-500", icon: AlertTriangle },
  medium:        { label: "Medium",        classes: "bg-amber-500/12 text-amber-400 border-amber-500/20",    dot: "bg-amber-400",  icon: Info },
  low:           { label: "Low",           classes: "bg-blue-500/12 text-blue-400 border-blue-500/20",       dot: "bg-blue-400",   icon: CheckCircle2 },
  informational: { label: "Info",          classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20",       dot: "bg-zinc-500",   icon: Minus },
};

const STATUS_CONFIG: Record<IssueStatus, { label: string; classes: string }> = {
  open:         { label: "Open",         classes: "bg-red-500/12 text-red-400 border-red-500/20" },
  under_review: { label: "Under Review", classes: "bg-indigo-500/12 text-indigo-400 border-indigo-500/20" },
  resolved:     { label: "Resolved",     classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" },
  wont_fix:     { label: "Won't Fix",    classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  verified:     { label: "Verified",     classes: "bg-blue-500/12 text-blue-400 border-blue-500/20" },
};

const LAYER_LABELS: Record<IssueLayer, string> = {
  frontend:       "Frontend",
  backend:        "Backend",
  database:       "Database",
  api:            "API",
  infrastructure: "Infrastructure",
  security:       "Security",
  performance:    "Performance",
};

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  authentication:   "Authentication",
  authorization:    "Authorization",
  data_validation:  "Data Validation",
  error_handling:   "Error Handling",
  performance:      "Performance",
  security:         "Security",
  async_flow:       "Async Flow",
  state_management: "State Management",
  null_safety:      "Null Safety",
  memory_leak:      "Memory Leak",
  race_condition:   "Race Condition",
  api_integration:  "API Integration",
  database:         "Database",
  build:            "Build",
  dependency:       "Dependency",
  ui_ux:            "UI / UX",
  type_safety:      "Type Safety",
  configuration:    "Configuration",
};

const VERIFICATION_LABELS: Record<IssueVerificationStatus, string> = {
  unverified:     "Unverified",
  under_review:   "Under Review",
  verified:       "Verified",
  false_positive: "False Positive",
  closed:         "Closed",
};

const SCAN_BUTTONS: { type: ScanType; label: string; description: string; accent: string }[] = [
  { type: "full",         label: "Scan Project",      description: "Full scan",     accent: "indigo" },
  { type: "deep",         label: "Deep Scan",         description: "Thorough",      accent: "purple" },
  { type: "frontend",     label: "Scan Frontend",     description: "UI & assets",   accent: "blue" },
  { type: "backend",      label: "Scan Backend",      description: "API & logic",   accent: "cyan" },
  { type: "database",     label: "Scan Database",     description: "Schema & data", accent: "emerald" },
  { type: "api",          label: "Scan APIs",         description: "Endpoints",     accent: "teal" },
  { type: "integrations", label: "Scan Integrations", description: "Third-party",   accent: "violet" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: IssueStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function ConfidencePip({ value }: { value: number }) {
  const color = value >= 90 ? "text-emerald-400" : value >= 75 ? "text-amber-400" : "text-zinc-500";
  return <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}%</span>;
}

function HealthCard({ card }: { card: SystemHealthCard }) {
  const HEALTH_CONFIG = {
    healthy:  { label: "Healthy",  icon: CheckCircle2,  ring: "ring-emerald-500/20", dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10" },
    warning:  { label: "Warning",  icon: AlertTriangle, ring: "ring-amber-500/20",  dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/10" },
    critical: { label: "Critical", icon: AlertCircle,   ring: "ring-red-500/20",    dot: "bg-red-500",     text: "text-red-400",     bg: "bg-red-500/10" },
    unknown:  { label: "Unknown",  icon: Clock,         ring: "ring-zinc-700",      dot: "bg-zinc-600",    text: "text-zinc-500",    bg: "bg-zinc-800/60" },
  } as const;

  const cfg = HEALTH_CONFIG[card.status] ?? HEALTH_CONFIG.unknown;
  const Icon = cfg.icon;
  const systemIcons: Record<string, React.ElementType> = {
    frontend: Globe, backend: Server, database: Database,
    apis: Activity, websocket: Zap, cache: HardDrive, build: Hammer,
  };
  const SystemIcon = systemIcons[card.id] ?? Activity;

  return (
    <div className={`rounded-2xl bg-[#18181b] border border-white/[0.06] p-4 ring-1 ${cfg.ring} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center`}>
          <SystemIcon className={`w-4 h-4 ${cfg.text}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-white mb-0.5">{card.name}</p>
      <p className="text-[11px] text-zinc-600">
        {card.lastChecked ? `Checked ${new Date(card.lastChecked).toLocaleString()}` : "Not yet scanned"}
      </p>
    </div>
  );
}

function ScanButton({ item, scanning, onScan }: {
  item: typeof SCAN_BUTTONS[0];
  scanning: ScanType | null;
  onScan: (type: ScanType) => void;
}) {
  const isThis = scanning === item.type;
  const isBusy = scanning !== null;
  const accents: Record<string, string> = {
    indigo:  "border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/10 hover:border-indigo-500/70",
    purple:  "border-purple-500/40 text-purple-300 hover:bg-purple-600/10 hover:border-purple-500/70",
    blue:    "border-blue-500/40 text-blue-300 hover:bg-blue-600/10 hover:border-blue-500/70",
    cyan:    "border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/10 hover:border-cyan-500/70",
    emerald: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/10 hover:border-emerald-500/70",
    teal:    "border-teal-500/40 text-teal-300 hover:bg-teal-600/10 hover:border-teal-500/70",
    violet:  "border-violet-500/40 text-violet-300 hover:bg-violet-600/10 hover:border-violet-500/70",
  };
  return (
    <button
      onClick={() => onScan(item.type)}
      disabled={isBusy}
      className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border text-left transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${accents[item.accent] ?? accents.indigo} ${isThis ? "opacity-75" : ""}`}
    >
      <div className="flex items-center gap-2">
        {isThis ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
        <span className="text-sm font-medium">{isThis ? "Scanning…" : item.label}</span>
      </div>
      <span className="text-[11px] text-zinc-500 pl-5">{item.description}</span>
    </button>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface IssueFilters {
  severity:           SeverityFilter;
  category:           CategoryFilter;
  layer:              LayerFilter;
  status:             StatusFilter;
  verificationStatus: VerificationFilter;
  module:             string;
  search:             string;
  dateFrom:           string;
  dateTo:             string;
  minConfidence:      number;
}

const DEFAULT_FILTERS: IssueFilters = {
  severity:           "all",
  category:           "all",
  layer:              "all",
  status:             "all",
  verificationStatus: "all",
  module:             "",
  search:             "",
  dateFrom:           "",
  dateTo:             "",
  minConfidence:      0,
};

function hasActiveFilters(f: IssueFilters): boolean {
  return (
    f.severity !== "all" || f.category !== "all" || f.layer !== "all" ||
    f.status !== "all" || f.verificationStatus !== "all" ||
    f.module !== "" || f.search !== "" || f.dateFrom !== "" ||
    f.dateTo !== "" || f.minConfidence > 0
  );
}

function FilterSelect<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="appearance-none pl-3 pr-8 py-2 text-xs bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 cursor-pointer"
      >
        <option value="all">{label}: All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
    </div>
  );
}

// ─── Snapshot status badge ────────────────────────────────────────────────────

function SnapshotStatusBadge({ status }: { status: ProjectSnapshot["status"] }) {
  const cfg = {
    active:     "bg-violet-500/12 text-violet-400 border-violet-500/20",
    restored:   "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
    superseded: "bg-zinc-500/12 text-zinc-500 border-zinc-700/50",
  };
  const labels = { active: "Active", restored: "Restored", superseded: "Superseded" };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${cfg[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AIDeveloperPage() {
  const { can } = useAdminAccess();

  const [healthCards,    setHealthCards]    = useState<SystemHealthCard[]>([]);
  const [healthLoading,  setHealthLoading]  = useState(true);
  const [summary,        setSummary]        = useState<IssueSummary>({ critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: 0 });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [issues,         setIssues]         = useState<DevIssue[]>([]);
  const [issuesLoading,  setIssuesLoading]  = useState(true);
  const [scans,          setScans]          = useState<ScanRecord[]>([]);
  const [scansLoading,   setScansLoading]   = useState(true);
  const [scanning,       setScanning]       = useState<ScanType | null>(null);
  const [filters,        setFilters]        = useState<IssueFilters>(DEFAULT_FILTERS);
  const [showFilters,    setShowFilters]    = useState(false);

  // ── Panel state ──────────────────────────────────────────────────────────────
  const [selectedIssueId,      setSelectedIssueId]      = useState<string | null>(null);
  const [patchIssueId,         setPatchIssueId]         = useState<string | null>(null);
  const [fixEnginePatch,       setFixEnginePatch]        = useState<PatchProposal | null>(null);
  const [versionHistoryIssueId, setVersionHistoryIssueId] = useState<string | null>(null);
  const [rollbackSnapshot,     setRollbackSnapshot]     = useState<ProjectSnapshot | null>(null);

  // ── Log state ────────────────────────────────────────────────────────────────
  const [auditLog,         setAuditLog]         = useState<FixAuditEntry[]>([]);
  const [rollbackLog,      setRollbackLog]       = useState<RollbackAuditEntry[]>([]);
  const [snapshots,        setSnapshots]         = useState<ProjectSnapshot[]>([]);
  const [analysisHistory,  setAnalysisHistory]   = useState<AnalysisRecord[]>([]);

  const setFilter = <K extends keyof IssueFilters>(key: K, val: IssueFilters[K]) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const load = useCallback(async () => {
    setHealthLoading(true);
    setSummaryLoading(true);
    setIssuesLoading(true);
    setScansLoading(true);

    const [health, sum, iss, sc, analysisHist] = await Promise.all([
      activeIssueProvider.fetchSystemHealth(),
      activeIssueProvider.fetchIssueSummary(),
      activeIssueProvider.fetchIssues(),
      activeIssueProvider.fetchScanHistory(),
      activeIssueProvider.fetchAnalysisHistory().catch(() => ({ items: [], total: 0 })),
    ]);

    setHealthCards(health);                setHealthLoading(false);
    setSummary(sum);                       setSummaryLoading(false);
    setIssues(iss.items);                  setIssuesLoading(false);
    setScans(sc.items);                    setScansLoading(false);
    setAnalysisHistory(analysisHist.items);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScan = useCallback(async (type: ScanType) => {
    if (scanning) return;
    setScanning(type);
    try {
      await activeIssueProvider.triggerScan(type);
      await load();
    } finally {
      setScanning(null);
    }
  }, [scanning, load]);

  const handleIssueUpdate = useCallback((updated: DevIssue) => {
    setIssues(prev => prev.map(i => i.id === updated.id ? updated : i));
  }, []);

  // ── Phase 13.5 — Apply Fix handler captures snapshot + version events ────────
  const handleApplyFix = useCallback((patch: PatchProposal) => {
    const issue = issues.find(i => i.id === patch.issueId);
    if (issue) {
      const snap = snapshotService.captureSnapshot(patch, issue);
      setSnapshots(prev => [snap, ...prev]);

      versionHistoryService.recordEvent({
        issueId: issue.id,
        patchId: patch.id,
        snapshotId: snap.id,
        event: "snapshot_created",
        summary: `Snapshot ${snap.id} captured — ${snap.affectedFiles.length} file(s), ` +
          `${snap.metadata.totalLinesAdded}+ / ${snap.metadata.totalLinesRemoved}− lines.`,
      });

      versionHistoryService.recordEvent({
        issueId: issue.id,
        patchId: patch.id,
        snapshotId: snap.id,
        event: "fix_initiated",
        summary: `Fix Engine started for patch ${patch.id}. Risk: ${snap.metadata.riskLevel}. ` +
          `Complexity: ${snap.metadata.complexity}.`,
      });
    }
    setPatchIssueId(null);
    setFixEnginePatch(patch);
  }, [issues]);

  // ── Phase 13.5 — Fix Complete handler records version events ─────────────────
  const handleFixComplete = useCallback((entry: FixAuditEntry, issueId: string) => {
    setAuditLog(prev => [entry, ...prev]);

    versionHistoryService.recordEvent({
      issueId,
      patchId: entry.patchId,
      auditId: entry.id,
      event: entry.finalStatus === "closed" ? "fix_applied" : "fix_failed",
      summary: entry.finalStatus === "closed"
        ? `Fix applied in ${(entry.totalDurationMs / 1000).toFixed(1)}s. All verifications passed.`
        : `Fix failed at step: ${entry.failedStepLabel ?? "unknown"}. ` +
          `${entry.errorMessage ?? ""}`,
    });

    if (entry.finalStatus === "closed") {
      versionHistoryService.recordEvent({
        issueId,
        patchId: entry.patchId,
        auditId: entry.id,
        event: "issue_closed",
        summary: `Issue ${issueId} closed. Patch ${entry.patchId} successfully applied by ${entry.appliedBy}.`,
      });

      setIssues(prev => prev.map(i =>
        i.id === issueId
          ? {
              ...i,
              status: "resolved" as IssueStatus,
              verificationStatus: "verified" as IssueVerificationStatus,
              updatedAt: new Date().toISOString(),
            }
          : i,
      ));
    }
  }, []);

  // ── Phase 13.5 — Rollback Complete handler restores state ────────────────────
  const handleRollbackComplete = useCallback((entry: RollbackAuditEntry, snapshot: ProjectSnapshot) => {
    setRollbackLog(prev => [entry, ...prev]);
    snapshotService.markRestored(snapshot.id);
    setSnapshots(snapshotService.listSnapshots());

    if (entry.finalStatus === "rolled_back") {
      versionHistoryService.recordEvent({
        issueId: snapshot.issueId,
        patchId: snapshot.patchId,
        snapshotId: snapshot.id,
        event: "rollback_complete",
        summary:
          `Rollback complete in ${(entry.totalDurationMs / 1000).toFixed(1)}s. ` +
          `Issue ${snapshot.issueId} restored: status → "${entry.restoredStatus}", ` +
          `verificationStatus → "${entry.restoredVerificationStatus}".`,
      });

      setIssues(prev => prev.map(i =>
        i.id === snapshot.issueId
          ? {
              ...i,
              status: snapshot.issueStateBefore.status,
              verificationStatus: snapshot.issueStateBefore.verificationStatus,
              updatedAt: new Date().toISOString(),
            }
          : i,
      ));
    } else {
      versionHistoryService.recordEvent({
        issueId: snapshot.issueId,
        patchId: snapshot.patchId,
        snapshotId: snapshot.id,
        event: "rollback_failed",
        summary:
          `Rollback failed at step: ${entry.failedStepLabel ?? "unknown"}. ` +
          `${entry.errorMessage ?? ""}`,
      });
    }

    setRollbackSnapshot(null);
  }, []);

  // Client-side filtering
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (filters.severity !== "all"           && issue.severity           !== filters.severity)           return false;
      if (filters.category !== "all"           && issue.category           !== filters.category)           return false;
      if (filters.layer    !== "all"           && issue.layer              !== filters.layer)              return false;
      if (filters.status   !== "all"           && issue.status             !== filters.status)             return false;
      if (filters.verificationStatus !== "all" && issue.verificationStatus !== filters.verificationStatus) return false;
      if (filters.minConfidence > 0            && issue.confidence         <  filters.minConfidence)       return false;
      if (filters.module && !issue.module.toLowerCase().includes(filters.module.toLowerCase())) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !issue.id.toLowerCase().includes(q) &&
          !issue.title.toLowerCase().includes(q) &&
          !issue.module.toLowerCase().includes(q) &&
          !issue.component.toLowerCase().includes(q) &&
          !(issue.file ?? "").toLowerCase().includes(q) &&
          !(issue.folder ?? "").toLowerCase().includes(q) &&
          !issue.description.toLowerCase().includes(q)
        ) return false;
      }
      if (filters.dateFrom && issue.createdAt < filters.dateFrom) return false;
      if (filters.dateTo   && issue.createdAt > filters.dateTo)   return false;
      return true;
    });
  }, [issues, filters]);

  // ── Table columns — Issues ──────────────────────────────────────────────────
  const issueColumns: Column<DevIssue>[] = [
    {
      key: "id",
      header: "Issue ID",
      sortable: true,
      sortValue: r => r.id,
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.id}</span>,
      width: "w-24",
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      sortValue: r => ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 }[r.severity]),
      render: r => <SeverityBadge severity={r.severity} />,
      width: "w-28",
    },
    {
      key: "confidence",
      header: "Conf.",
      sortable: true,
      sortValue: r => r.confidence,
      align: "right",
      render: r => <ConfidencePip value={r.confidence} />,
      width: "w-16",
      hideOnMobile: true,
    },
    {
      key: "layer",
      header: "Layer",
      sortable: true,
      sortValue: r => r.layer,
      render: r => <span className="text-xs text-zinc-400">{LAYER_LABELS[r.layer] ?? r.layer}</span>,
      hideOnMobile: true,
    },
    {
      key: "module",
      header: "Module",
      sortable: true,
      sortValue: r => r.module,
      render: r => (
        <span className="text-xs font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded-md">
          {r.module}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: r => r.status,
      render: r => <StatusPill status={r.status} />,
    },
    {
      key: "createdAt",
      header: "Detected",
      sortable: true,
      sortValue: r => r.createdAt,
      render: r => <span className="text-xs text-zinc-500">{new Date(r.createdAt).toLocaleDateString()}</span>,
      hideOnMobile: true,
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: true,
      sortValue: r => r.updatedAt,
      render: r => <span className="text-xs text-zinc-500">{new Date(r.updatedAt).toLocaleDateString()}</span>,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: r => (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={e => { e.stopPropagation(); setVersionHistoryIssueId(r.id); }}
            className="text-xs text-zinc-500 hover:text-violet-400 transition-colors font-medium flex items-center gap-1"
          >
            <History className="w-3 h-3" />
            History
          </button>
          <span className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer">
            Analyze →
          </span>
        </div>
      ),
    },
  ];

  // ── Table columns — Scan history ────────────────────────────────────────────
  const scanColumns: Column<ScanRecord>[] = [
    {
      key: "id",
      header: "Scan ID",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.id}</span>,
      width: "w-24",
    },
    {
      key: "scanType",
      header: "Type",
      sortable: true,
      sortValue: r => r.scanType,
      render: r => <span className="text-xs font-medium text-zinc-300 capitalize">{r.scanType}</span>,
    },
    {
      key: "startedAt",
      header: "Started",
      sortable: true,
      sortValue: r => r.startedAt,
      render: r => <span className="text-xs text-zinc-400">{new Date(r.startedAt).toLocaleString()}</span>,
      hideOnMobile: true,
    },
    {
      key: "completedAt",
      header: "Completed",
      sortable: true,
      sortValue: r => r.completedAt ?? "",
      render: r => <span className="text-xs text-zinc-400">{r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}</span>,
      hideOnMobile: true,
    },
    {
      key: "durationMs",
      header: "Duration",
      align: "right",
      render: r => <span className="text-xs text-zinc-400">{r.durationMs !== null ? `${(r.durationMs / 1000).toFixed(0)}s` : "—"}</span>,
      hideOnMobile: true,
    },
    {
      key: "issuesFound",
      header: "Issues",
      align: "right",
      sortable: true,
      sortValue: r => r.issuesFound,
      render: r => <span className={`text-xs font-semibold ${r.issuesFound > 0 ? "text-amber-400" : "text-zinc-500"}`}>{r.issuesFound}</span>,
    },
    {
      key: "status",
      header: "Result",
      render: r => {
        const cfg: Record<string, string> = {
          completed: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
          failed:    "bg-red-500/12 text-red-400 border-red-500/20",
          running:   "bg-indigo-500/12 text-indigo-400 border-indigo-500/20",
          cancelled: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20",
        };
        return (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${cfg[r.status] ?? cfg.cancelled}`}>
            {r.status}
          </span>
        );
      },
    },
  ];

  // ── Table columns — Fix Audit Log ──────────────────────────────────────────
  const auditColumns: Column<FixAuditEntry>[] = [
    {
      key: "id",
      header: "Audit ID",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.id}</span>,
      width: "w-24",
    },
    {
      key: "issueId",
      header: "Issue",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.issueId}</span>,
      width: "w-24",
    },
    {
      key: "patchId",
      header: "Patch",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.patchId}</span>,
      width: "w-24",
    },
    {
      key: "appliedBy",
      header: "Applied By",
      render: r => <span className="text-xs text-zinc-300">{r.appliedBy}</span>,
    },
    {
      key: "appliedAt",
      header: "Applied At",
      sortable: true,
      sortValue: r => r.appliedAt,
      render: r => <span className="text-xs text-zinc-400">{new Date(r.appliedAt).toLocaleString()}</span>,
      hideOnMobile: true,
    },
    {
      key: "verificationResult",
      header: "Result",
      render: r => {
        const ok = r.verificationResult === "success";
        return (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            ok
              ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/12 text-red-400 border-red-500/20"
          }`}>
            {ok ? "Success" : "Failed"}
          </span>
        );
      },
    },
    {
      key: "finalStatus",
      header: "Final Status",
      render: r => {
        const closed = r.finalStatus === "closed";
        return (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            closed
              ? "bg-blue-500/12 text-blue-400 border-blue-500/20"
              : "bg-amber-500/12 text-amber-400 border-amber-500/20"
          }`}>
            {closed ? "Closed" : "Fix Failed"}
          </span>
        );
      },
      hideOnMobile: true,
    },
  ];

  // ── Table columns — Snapshot History ───────────────────────────────────────
  const snapshotColumns: Column<ProjectSnapshot>[] = [
    {
      key: "id",
      header: "Snapshot ID",
      render: r => <span className="font-mono text-[11px] text-violet-400">{r.id}</span>,
      width: "w-28",
    },
    {
      key: "issueId",
      header: "Issue",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.issueId}</span>,
      width: "w-24",
    },
    {
      key: "patchId",
      header: "Patch",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.patchId}</span>,
      width: "w-24",
    },
    {
      key: "capturedAt",
      header: "Captured",
      sortable: true,
      sortValue: r => r.capturedAt,
      render: r => <span className="text-xs text-zinc-400">{new Date(r.capturedAt).toLocaleString()}</span>,
      hideOnMobile: true,
    },
    {
      key: "capturedBy",
      header: "By",
      render: r => <span className="text-xs text-zinc-400">{r.capturedBy}</span>,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: r => <SnapshotStatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: r => r.status === "active" ? (
        <button
          onClick={e => { e.stopPropagation(); setRollbackSnapshot(r); }}
          className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Roll Back
        </button>
      ) : null,
    },
  ];

  // ── Table columns — Rollback Audit Log ─────────────────────────────────────
  const rollbackColumns: Column<RollbackAuditEntry>[] = [
    {
      key: "id",
      header: "Rollback ID",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.id}</span>,
      width: "w-28",
    },
    {
      key: "snapshotId",
      header: "Snapshot",
      render: r => <span className="font-mono text-[11px] text-violet-400">{r.snapshotId}</span>,
      width: "w-28",
    },
    {
      key: "issueId",
      header: "Issue",
      render: r => <span className="font-mono text-[11px] text-zinc-400">{r.issueId}</span>,
      width: "w-24",
    },
    {
      key: "initiatedAt",
      header: "Initiated",
      sortable: true,
      sortValue: r => r.initiatedAt,
      render: r => <span className="text-xs text-zinc-400">{new Date(r.initiatedAt).toLocaleString()}</span>,
      hideOnMobile: true,
    },
    {
      key: "result",
      header: "Result",
      render: r => {
        const ok = r.result === "success";
        return (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            ok
              ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/12 text-red-400 border-red-500/20"
          }`}>
            {ok ? "Success" : "Failed"}
          </span>
        );
      },
    },
    {
      key: "finalStatus",
      header: "Final Status",
      render: r => {
        const ok = r.finalStatus === "rolled_back";
        return (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            ok
              ? "bg-amber-500/12 text-amber-400 border-amber-500/20"
              : "bg-red-500/12 text-red-400 border-red-500/20"
          }`}>
            {ok ? "Rolled Back" : "Rollback Failed"}
          </span>
        );
      },
      hideOnMobile: true,
    },
  ];

  if (!can("admin.developer.view")) {
    return (
      <div className="p-6 md:p-8">
        <EmptyState icon={ShieldAlert} title="Access Denied" description="You don't have permission to view the AI Developer Center." />
      </div>
    );
  }

  const activeFilterCount = [
    filters.severity !== "all", filters.category !== "all", filters.layer !== "all",
    filters.status !== "all", filters.verificationStatus !== "all",
    filters.module !== "", filters.dateFrom !== "", filters.dateTo !== "",
    filters.minConfidence > 0,
  ].filter(Boolean).length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-2xl">

      {/* ── Header ── */}
      <PageHeader
        title="AI Developer Center"
        description="System diagnostics, project health monitoring and developer tools."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 border border-zinc-700 rounded-xl hover:border-zinc-500 hover:text-zinc-200 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* ── System Health ── */}
      <SectionCard
        title="System Health"
        description="Real-time status of core platform components"
        actions={<span className="text-[11px] text-zinc-600 font-medium">{healthLoading ? "Checking…" : "Not yet scanned"}</span>}
      >
        {healthLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-zinc-800/50 animate-pulse" style={{ opacity: 1 - i * 0.1 }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {healthCards.map(card => <HealthCard key={card.id} card={card} />)}
          </div>
        )}
      </SectionCard>

      {/* ── Project Scan Controls ── */}
      <SectionCard title="Project Scan" description="Initiate a diagnostic scan of platform components">
        <div className="flex flex-wrap gap-3">
          {SCAN_BUTTONS.map(btn => <ScanButton key={btn.type} item={btn} scanning={scanning} onScan={handleScan} />)}
        </div>
        {scanning ? (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-indigo-300 font-medium">Scan in progress…</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">AI engine is ready. New scan results will appear in the issue list and scan history below.</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-zinc-600">
            Click any scan to run targeted analysis. Sample issues shown below represent AI engine output. Phase 14 connects the live scanning engine to backend endpoints.
          </p>
        )}
      </SectionCard>

      {/* ── Issue Summary ── */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Issue Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard title="Critical"      value={summaryLoading ? "—" : summary.critical}      icon={AlertCircle}  iconColor="text-red-400"    iconBg="bg-red-500/10"    loading={summaryLoading} />
          <StatCard title="High"          value={summaryLoading ? "—" : summary.high}          icon={AlertTriangle}iconColor="text-orange-400"  iconBg="bg-orange-500/10" loading={summaryLoading} />
          <StatCard title="Medium"        value={summaryLoading ? "—" : summary.medium}        icon={Info}         iconColor="text-amber-400"   iconBg="bg-amber-500/10"  loading={summaryLoading} />
          <StatCard title="Low"           value={summaryLoading ? "—" : summary.low}           icon={CheckCircle2} iconColor="text-blue-400"    iconBg="bg-blue-500/10"   loading={summaryLoading} />
          <StatCard title="Informational" value={summaryLoading ? "—" : summary.informational} icon={Minus}        iconColor="text-zinc-400"    iconBg="bg-zinc-700/50"   loading={summaryLoading} />
          <StatCard title="Total Issues"  value={summaryLoading ? "—" : summary.total}         icon={ClipboardList}iconColor="text-indigo-400"  iconBg="bg-indigo-500/10" loading={summaryLoading} />
        </div>
      </div>

      {/* ── Issue List ── */}
      <SectionCard
        title="Issue List"
        description={filteredIssues.length !== issues.length
          ? `${filteredIssues.length} of ${issues.length} issues — filters active`
          : `${issues.length} issues detected`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                showFilters || hasActiveFilters(filters)
                  ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Filter className="w-3 h-3" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 h-4 min-w-[16px] px-1 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {hasActiveFilters(filters) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        }
      >
        {/* ── Filter panel ── */}
        {showFilters && (
          <div className="mb-5 p-4 rounded-xl bg-zinc-900/50 border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Filter Issues
              </p>
              <button onClick={() => setShowFilters(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <FilterSelect<SeverityFilter>
                label="Severity" value={filters.severity} onChange={v => setFilter("severity", v)}
                options={[
                  { value: "critical",      label: "Critical" },
                  { value: "high",          label: "High" },
                  { value: "medium",        label: "Medium" },
                  { value: "low",           label: "Low" },
                  { value: "informational", label: "Informational" },
                ]}
              />
              <FilterSelect<CategoryFilter>
                label="Category" value={filters.category} onChange={v => setFilter("category", v)}
                options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as IssueCategory, label }))}
              />
              <FilterSelect<LayerFilter>
                label="Layer" value={filters.layer} onChange={v => setFilter("layer", v)}
                options={Object.entries(LAYER_LABELS).map(([value, label]) => ({ value: value as IssueLayer, label }))}
              />
              <FilterSelect<StatusFilter>
                label="Status" value={filters.status} onChange={v => setFilter("status", v)}
                options={[
                  { value: "open",         label: "Open" },
                  { value: "under_review", label: "Under Review" },
                  { value: "resolved",     label: "Resolved" },
                  { value: "wont_fix",     label: "Won't Fix" },
                  { value: "verified",     label: "Verified" },
                ]}
              />
              <FilterSelect<VerificationFilter>
                label="Verification" value={filters.verificationStatus} onChange={v => setFilter("verificationStatus", v)}
                options={Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value: value as IssueVerificationStatus, label }))}
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Module…"
                  value={filters.module}
                  onChange={e => setFilter("module", e.target.value)}
                  className="pl-7 pr-3 py-2 text-xs bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 w-36"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-white/[0.07] rounded-xl">
                <Layers className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                <span className="text-xs text-zinc-500 whitespace-nowrap">Conf ≥</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.minConfidence}
                  onChange={e => setFilter("minConfidence", Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-10 text-xs bg-transparent text-zinc-300 focus:outline-none text-right"
                />
                <span className="text-xs text-zinc-600">%</span>
              </div>

              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilter("dateFrom", e.target.value)}
                  className="pl-7 pr-3 py-2 text-xs bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <span className="text-xs text-zinc-600">to</span>
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilter("dateTo", e.target.value)}
                  className="pl-7 pr-3 py-2 text-xs bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {hasActiveFilters(filters) && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-xl hover:border-zinc-500 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by ID, title, module, component, file, folder, keyword…"
                value={filters.search}
                onChange={e => setFilter("search", e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              {filters.search && (
                <button onClick={() => setFilter("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {issuesLoading ? (
          <div className="space-y-2.5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-zinc-800/50 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />)}
          </div>
        ) : filteredIssues.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters(filters) ? FileWarning : BrainCircuit}
            title={hasActiveFilters(filters) ? "No matching issues" : "No issues detected"}
            description={
              hasActiveFilters(filters)
                ? "Try adjusting your filters or clearing the search."
                : "Run a project scan to begin analysis."
            }
            action={hasActiveFilters(filters) ? { label: "Reset filters", onClick: resetFilters } : undefined}
          />
        ) : (
          <DataTable<DevIssue>
            data={filteredIssues}
            columns={issueColumns}
            keyExtractor={r => r.id}
            pageSize={20}
            emptyIcon={FileWarning}
            emptyTitle="No issues match"
            emptyDescription="Adjust your filters or search term."
            onRowClick={row => setSelectedIssueId(row.id)}
          />
        )}
      </SectionCard>

      {/* ── Scan History ── */}
      <SectionCard title="Scan History" description="Record of all past project scans">
        {scansLoading ? (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-zinc-800/50 animate-pulse" style={{ opacity: 1 - i * 0.25 }} />)}
          </div>
        ) : (
          <DataTable<ScanRecord>
            data={scans}
            columns={scanColumns}
            keyExtractor={r => r.id}
            pageSize={10}
            emptyIcon={Layers}
            emptyTitle="No scans yet"
            emptyDescription="Trigger a scan above to begin tracking history."
            searchPlaceholder="Search scans…"
            searchKeys={["scanType", "triggeredBy"]}
          />
        )}
      </SectionCard>

      {/* ── Fix Audit Log (Phase 13.4) — visible once fixes have been applied ── */}
      {auditLog.length > 0 && (
        <SectionCard
          title="Fix Audit Log"
          description="Record of all fix executions in this session"
        >
          <DataTable<FixAuditEntry>
            data={auditLog}
            columns={auditColumns}
            keyExtractor={r => r.id}
            pageSize={10}
            emptyIcon={ClipboardList}
            emptyTitle="No fix executions"
            emptyDescription="Apply an approved patch to record an entry here."
          />
        </SectionCard>
      )}

      {/* ── Snapshot History (Phase 13.5) — visible once snapshots exist ── */}
      {snapshots.length > 0 && (
        <SectionCard
          title="Snapshot History"
          description="State captured before each fix execution — active snapshots can be rolled back"
        >
          <DataTable<ProjectSnapshot>
            data={snapshots}
            columns={snapshotColumns}
            keyExtractor={r => r.id}
            pageSize={10}
            emptyIcon={Camera}
            emptyTitle="No snapshots"
            emptyDescription="Snapshots are captured automatically before each fix is applied."
            onRowClick={row => {
              if (row.status === "active") setRollbackSnapshot(row);
            }}
          />
        </SectionCard>
      )}

      {/* ── Rollback Audit Log (Phase 13.5) — visible once rollbacks have run ── */}
      {rollbackLog.length > 0 && (
        <SectionCard
          title="Rollback Audit Log"
          description="Record of all rollback executions in this session"
        >
          <DataTable<RollbackAuditEntry>
            data={rollbackLog}
            columns={rollbackColumns}
            keyExtractor={r => r.id}
            pageSize={10}
            emptyIcon={RotateCcw}
            emptyTitle="No rollbacks"
            emptyDescription="Initiate a rollback from the Snapshot History section or Version History panel."
          />
        </SectionCard>
      )}

      {/* ── Analysis History (Phase 14.2) ── */}
      {analysisHistory.length > 0 && (
        <SectionCard
          title="Analysis History"
          description="Record of intelligence-engine analysis runs in this session"
        >
          <div className="space-y-3">
            {analysisHistory.map(rec => (
              <div key={rec.id} className="rounded-xl bg-zinc-900/60 border border-white/[0.06] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">{rec.id}</code>
                    <code className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-lg">{rec.scanId}</code>
                  </div>
                  <span className="text-[11px] text-zinc-600">{new Date(rec.timestamp).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Files</p>
                    <span className="font-semibold text-zinc-300">{rec.filesAnalysed}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Issues</p>
                    <span className="font-semibold text-zinc-300">{rec.issuesAnalysed}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Graph Nodes</p>
                    <span className="font-semibold text-zinc-300">{rec.graphNodeCount}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Dependencies</p>
                    <span className="font-semibold text-zinc-300">{rec.dependenciesAnalysed}</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Duration</p>
                    <span className="font-semibold text-zinc-300">{(rec.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Modules</p>
                    <span className="font-semibold text-zinc-300">{rec.modulesAnalysed.length}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-600">
                  <span>Analysis v{rec.analysisVersion}</span>
                  <span>·</span>
                  <span>Scanner v{rec.scannerVersion}</span>
                  <span>·</span>
                  <span>{rec.graphEdgeCount} edges</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Issue Detail Panel (slide-over) ── */}
      <IssueDetailPanel
        issueId={selectedIssueId}
        onClose={() => setSelectedIssueId(null)}
        onIssueUpdate={handleIssueUpdate}
        onGeneratePatch={(id) => {
          setSelectedIssueId(null);
          setPatchIssueId(id);
        }}
      />

      {/* ── Version History Panel — Phase 13.5 (slide-over, z:40/50) ── */}
      <VersionHistoryPanel
        issueId={versionHistoryIssueId}
        onClose={() => setVersionHistoryIssueId(null)}
        onRollback={(snap) => {
          setVersionHistoryIssueId(null);
          setRollbackSnapshot(snap);
        }}
      />

      {/* ── Patch Panel (centered modal — Phase 13.3, z:50/60) ── */}
      <PatchPanel
        issueId={patchIssueId}
        onClose={() => setPatchIssueId(null)}
        onPatchUpdate={() => {}}
        onApplyFix={handleApplyFix}
      />

      {/* ── Fix Engine Panel (Phase 13.4, z:70/80) ── */}
      <FixEnginePanel
        patch={fixEnginePatch}
        onClose={() => setFixEnginePatch(null)}
        onFixComplete={handleFixComplete}
      />

      {/* ── Rollback Panel (Phase 13.5, z:90/100) ── */}
      <RollbackPanel
        snapshot={rollbackSnapshot}
        onClose={() => setRollbackSnapshot(null)}
        onRollbackComplete={handleRollbackComplete}
      />

    </div>
  );
}
