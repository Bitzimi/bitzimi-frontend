/**
 * IssueDetailPanel — full analysis view for a detected issue.
 *
 * Phase 13.2: Analysis only. No patch generation, no code modification.
 * Displays: severity, confidence, location, root cause, impact,
 * dependencies, affected components, suggested approaches, status.
 */

import { useState, useEffect } from "react";
import {
  X, AlertCircle, AlertTriangle, Info, CheckCircle2, Minus,
  FileCode2, FolderOpen, Hash, Layers, Box, Tag,
  GitBranch, Puzzle, Lightbulb, Clock, User, ShieldCheck,
  ChevronDown, ArrowUpRight, Copy, Check, Zap,
  Network, TrendingUp, BookOpen, Link,
} from "lucide-react";
import {
  type DevIssue,
  type IssueStatus,
  type IssueVerificationStatus,
  type ImpactArea,
  type IssueLayer,
  type IssueCategory,
} from "../../services/developerService";
import { activeIssueProvider } from "../../services/analysisProvider";

// ─── Config maps ──────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical:      { label: "Critical",      icon: AlertCircle,  classes: "bg-red-500/12 text-red-400 border-red-500/20",           dot: "bg-red-500",    bar: "bg-red-500" },
  high:          { label: "High",          icon: AlertTriangle,classes: "bg-orange-500/12 text-orange-400 border-orange-500/20",   dot: "bg-orange-500", bar: "bg-orange-500" },
  medium:        { label: "Medium",        icon: Info,         classes: "bg-amber-500/12 text-amber-400 border-amber-500/20",     dot: "bg-amber-400",  bar: "bg-amber-400" },
  low:           { label: "Low",           icon: CheckCircle2, classes: "bg-blue-500/12 text-blue-400 border-blue-500/20",        dot: "bg-blue-400",   bar: "bg-blue-400" },
  informational: { label: "Informational", icon: Minus,        classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20",        dot: "bg-zinc-500",   bar: "bg-zinc-500" },
} as const;

const STATUS_CONFIG: Record<IssueStatus, { label: string; classes: string }> = {
  open:         { label: "Open",         classes: "bg-red-500/12 text-red-400 border-red-500/20" },
  under_review: { label: "Under Review", classes: "bg-indigo-500/12 text-indigo-400 border-indigo-500/20" },
  resolved:     { label: "Resolved",     classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" },
  wont_fix:     { label: "Won't Fix",    classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  verified:     { label: "Verified",     classes: "bg-blue-500/12 text-blue-400 border-blue-500/20" },
};

const VERIFICATION_CONFIG: Record<IssueVerificationStatus, { label: string; classes: string }> = {
  unverified:    { label: "Unverified",    classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  under_review:  { label: "Under Review",  classes: "bg-indigo-500/12 text-indigo-400 border-indigo-500/20" },
  verified:      { label: "Verified",      classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" },
  false_positive:{ label: "False Positive",classes: "bg-amber-500/12 text-amber-400 border-amber-500/20" },
  closed:        { label: "Closed",        classes: "bg-zinc-700/50 text-zinc-500 border-zinc-700" },
};

const IMPACT_CONFIG: Record<ImpactArea, { label: string; classes: string }> = {
  performance:    { label: "Performance",    classes: "bg-purple-500/12 text-purple-400 border-purple-500/20" },
  security:       { label: "Security",       classes: "bg-red-500/12 text-red-400 border-red-500/20" },
  data_integrity: { label: "Data Integrity", classes: "bg-orange-500/12 text-orange-400 border-orange-500/20" },
  user_experience:{ label: "UX",             classes: "bg-blue-500/12 text-blue-400 border-blue-500/20" },
  build:          { label: "Build",          classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  compilation:    { label: "Compilation",    classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  runtime:        { label: "Runtime",        classes: "bg-amber-500/12 text-amber-400 border-amber-500/20" },
  financial:      { label: "Financial",      classes: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20" },
  gameplay:       { label: "Gameplay",       classes: "bg-cyan-500/12 text-cyan-400 border-cyan-500/20" },
  authentication: { label: "Authentication", classes: "bg-indigo-500/12 text-indigo-400 border-indigo-500/20" },
  admin:          { label: "Admin",          classes: "bg-violet-500/12 text-violet-400 border-violet-500/20" },
  api:            { label: "API",            classes: "bg-teal-500/12 text-teal-400 border-teal-500/20" },
  database:       { label: "Database",       classes: "bg-pink-500/12 text-pink-400 border-pink-500/20" },
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

// ─── Status transition options ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open",         label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved",     label: "Resolved" },
  { value: "wont_fix",     label: "Won't Fix" },
  { value: "verified",     label: "Verified" },
];

const VERIFICATION_OPTIONS: { value: IssueVerificationStatus; label: string }[] = [
  { value: "unverified",     label: "Unverified" },
  { value: "under_review",   label: "Under Review" },
  { value: "verified",       label: "Verified" },
  { value: "false_positive", label: "False Positive" },
  { value: "closed",         label: "Closed" },
];

// ─── Small reusable pieces ────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
      <span className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">{label}</span>
    </div>
  );
}

function InfoCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-zinc-900/60 border border-white/[0.06] p-4 ${className}`}>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-1 p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
      title="Copy"
    >
      {copied
        ? <Check className="w-3 h-3 text-emerald-400" />
        : <Copy className="w-3 h-3" />
      }
    </button>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 90 ? "bg-emerald-500" : value >= 75 ? "bg-amber-400" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-zinc-300 tabular-nums w-9 text-right">{value}%</span>
    </div>
  );
}

// ─── Status controls ──────────────────────────────────────────────────────────

interface StatusControlsProps {
  issue: DevIssue;
  onStatusChange: (status: IssueStatus, verificationStatus: IssueVerificationStatus) => void;
  updating: boolean;
}

function StatusControls({ issue, onStatusChange, updating }: StatusControlsProps) {
  const [statusOpen,  setStatusOpen]  = useState(false);
  const [verifyOpen,  setVerifyOpen]  = useState(false);
  const sCfg = STATUS_CONFIG[issue.status];
  const vCfg = VERIFICATION_CONFIG[issue.verificationStatus];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status dropdown */}
      <div className="relative">
        <button
          onClick={() => { setStatusOpen(o => !o); setVerifyOpen(false); }}
          disabled={updating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-40"
          style={{ background: "transparent" }}
        >
          <span className={`inline-flex items-center gap-1.5 ${sCfg.classes.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
            {sCfg.label}
          </span>
          <ChevronDown className="w-3 h-3 text-zinc-500" />
        </button>
        {statusOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-[#1c1c22] border border-white/[0.08] rounded-xl shadow-2xl min-w-[160px] overflow-hidden">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  onStatusChange(opt.value, issue.verificationStatus);
                  setStatusOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors ${
                  opt.value === issue.status ? "text-indigo-300 bg-indigo-600/10" : "text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Verification dropdown */}
      <div className="relative">
        <button
          onClick={() => { setVerifyOpen(o => !o); setStatusOpen(false); }}
          disabled={updating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all disabled:opacity-40"
        >
          <ShieldCheck className="w-3 h-3" />
          {vCfg.label}
          <ChevronDown className="w-3 h-3 text-zinc-500" />
        </button>
        {verifyOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-[#1c1c22] border border-white/[0.08] rounded-xl shadow-2xl min-w-[160px] overflow-hidden">
            {VERIFICATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  onStatusChange(issue.status, opt.value);
                  setVerifyOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors ${
                  opt.value === issue.verificationStatus ? "text-indigo-300 bg-indigo-600/10" : "text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {updating && <span className="text-[11px] text-zinc-500 italic">Saving…</span>}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface IssueDetailPanelProps {
  issueId: string | null;
  onClose: () => void;
  onIssueUpdate?: (updated: DevIssue) => void;
  onGeneratePatch?: (issueId: string) => void;
}

export function IssueDetailPanel({ issueId, onClose, onIssueUpdate, onGeneratePatch }: IssueDetailPanelProps) {
  const [issue,    setIssue]    = useState<DevIssue | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!issueId) { setIssue(null); return; }
    setLoading(true);
    activeIssueProvider.fetchIssueById(issueId).then(i => {
      setIssue(i);
      setLoading(false);
    });
  }, [issueId]);

  const handleStatusChange = async (status: IssueStatus, verificationStatus: IssueVerificationStatus) => {
    if (!issue) return;
    setUpdating(true);
    await activeIssueProvider.updateIssueStatus(issue.id, status, verificationStatus);
    const updated = { ...issue, status, verificationStatus, updatedAt: new Date().toISOString() };
    setIssue(updated);
    onIssueUpdate?.(updated);
    setUpdating(false);
  };

  const isOpen = issueId !== null;
  const sev = issue ? SEVERITY_CONFIG[issue.severity] : null;
  const SevIcon = sev?.icon ?? Minus;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`
          fixed right-0 top-0 h-full z-50 w-full max-w-2xl
          bg-[#111115] border-l border-white/[0.06] shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* ── Panel header ── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06] bg-[#111115]">
          {issue ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sev?.classes ?? ""}`}>
                <SevIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-zinc-400">{issue.id}</p>
                <p className="text-sm font-semibold text-white truncate leading-tight">{issue.title}</p>
              </div>
            </div>
          ) : (
            <div className="h-8 w-48 rounded-lg bg-zinc-800 animate-pulse" />
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-zinc-800/50 animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
              ))}
            </div>
          )}

          {!loading && !issue && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <AlertCircle className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-sm font-medium text-zinc-400">Issue not found</p>
              <p className="text-xs text-zinc-600 mt-1">This issue may have been removed or the ID is invalid.</p>
            </div>
          )}

          {!loading && issue && (
            <div className="p-6 space-y-5">

              {/* ── Severity + Confidence ── */}
              <InfoCard>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase mb-2">Severity</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${sev?.classes ?? ""}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sev?.dot ?? ""}`} />
                        {sev?.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase mb-2">Confidence</p>
                    <ConfidenceBar value={issue.confidence} />
                  </div>
                </div>
              </InfoCard>

              {/* ── Status management ── */}
              <div>
                <SectionHeading icon={ShieldCheck} label="Status" />
                <InfoCard>
                  <StatusControls issue={issue} onStatusChange={handleStatusChange} updating={updating} />
                </InfoCard>
              </div>

              {/* ── Location ── */}
              <div>
                <SectionHeading icon={FileCode2} label="Location" />
                <InfoCard>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                      <div>
                        <p className="text-zinc-600 mb-0.5">Layer</p>
                        <span className="text-zinc-300 font-medium">{LAYER_LABELS[issue.layer] ?? issue.layer}</span>
                      </div>
                      <div>
                        <p className="text-zinc-600 mb-0.5">Module</p>
                        <span className="font-mono text-indigo-300">{issue.module}</span>
                      </div>
                      <div>
                        <p className="text-zinc-600 mb-0.5">Component</p>
                        <span className="font-mono text-zinc-300">{issue.component}</span>
                      </div>
                      <div>
                        <p className="text-zinc-600 mb-0.5">Category</p>
                        <span className="text-zinc-300">{CATEGORY_LABELS[issue.category] ?? issue.category}</span>
                      </div>
                    </div>

                    {issue.file && (
                      <div className="pt-2 border-t border-white/[0.04]">
                        <p className="text-[10px] text-zinc-600 mb-1 flex items-center gap-1">
                          <FileCode2 className="w-3 h-3" /> File
                        </p>
                        <div className="flex items-center gap-1">
                          <code className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded-lg break-all flex-1">
                            {issue.file}
                            {issue.line ? `:${issue.line}` : ""}
                          </code>
                          <CopyButton text={issue.file + (issue.line ? `:${issue.line}` : "")} />
                        </div>
                      </div>
                    )}

                    {issue.folder && (
                      <div>
                        <p className="text-[10px] text-zinc-600 mb-1 flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" /> Folder
                        </p>
                        <div className="flex items-center gap-1">
                          <code className="text-[11px] font-mono text-zinc-500 bg-zinc-800 px-2 py-1 rounded-lg flex-1">
                            {issue.folder}
                          </code>
                          <CopyButton text={issue.folder} />
                        </div>
                      </div>
                    )}
                  </div>
                </InfoCard>
              </div>

              {/* ── General Information ── */}
              <div>
                <SectionHeading icon={Tag} label="General Information" />
                <InfoCard>
                  <h4 className="text-sm font-semibold text-white mb-2 leading-snug">{issue.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{issue.description}</p>
                  <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div>
                      <span className="text-zinc-600">Reporter: </span>
                      <span className="text-zinc-400 font-medium">{issue.reportedBy === "ai" ? "AI Engine" : issue.reportedBy}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Created: </span>
                      <span className="text-zinc-400">{new Date(issue.createdAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Verification: </span>
                      <span className={`font-medium ${VERIFICATION_CONFIG[issue.verificationStatus].classes.split(" ").find(c => c.startsWith("text-")) ?? "text-zinc-400"}`}>
                        {VERIFICATION_CONFIG[issue.verificationStatus].label}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Updated: </span>
                      <span className="text-zinc-400">{new Date(issue.updatedAt).toLocaleString()}</span>
                    </div>
                    {issue.resolvedAt && (
                      <div className="col-span-2">
                        <span className="text-zinc-600">Resolved: </span>
                        <span className="text-emerald-400">{new Date(issue.resolvedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {issue.verifiedBy && (
                      <div className="col-span-2">
                        <span className="text-zinc-600">Verified by: </span>
                        <span className="text-zinc-400">{issue.verifiedBy}</span>
                      </div>
                    )}
                  </div>
                </InfoCard>
              </div>

              {/* ── Root Cause ── */}
              <div>
                <SectionHeading icon={GitBranch} label="Root Cause Analysis" />
                <InfoCard>
                  <p className="text-xs text-zinc-300 leading-relaxed">{issue.rootCause}</p>
                </InfoCard>
              </div>

              {/* ── Impact Analysis ── */}
              <div>
                <SectionHeading icon={ArrowUpRight} label="Impact Analysis" />
                <InfoCard>
                  {issue.impact.length === 0 ? (
                    <p className="text-xs text-zinc-600">No impact areas identified.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {issue.impact.map(area => {
                        const cfg = IMPACT_CONFIG[area];
                        return (
                          <span
                            key={area}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${cfg.classes}`}
                          >
                            {cfg.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </InfoCard>
              </div>

              {/* ── Affected Components ── */}
              {issue.affectedComponents.length > 0 && (
                <div>
                  <SectionHeading icon={Box} label="Affected Components" />
                  <InfoCard>
                    <div className="flex flex-wrap gap-2">
                      {issue.affectedComponents.map(comp => (
                        <div key={comp} className="flex items-center gap-1">
                          <code className="text-[11px] font-mono text-indigo-300 bg-indigo-500/8 border border-indigo-500/15 px-2 py-0.5 rounded-md">
                            {comp}
                          </code>
                        </div>
                      ))}
                    </div>
                  </InfoCard>
                </div>
              )}

              {/* ── Dependency Analysis ── */}
              {issue.dependencies.length > 0 && (
                <div>
                  <SectionHeading icon={Puzzle} label="Dependency Analysis" />
                  <InfoCard>
                    <div className="space-y-2">
                      {issue.dependencies.map(dep => (
                        <div key={dep} className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <code className="text-[11px] font-mono text-zinc-400 truncate">{dep}</code>
                            <CopyButton text={dep} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </InfoCard>
                </div>
              )}

              {/* ── Suggested Approaches ── */}
              {issue.suggestedApproaches.length > 0 && (
                <div>
                  <SectionHeading icon={Lightbulb} label="Suggested Approaches" />
                  <InfoCard>
                    <div className="space-y-3">
                      {issue.suggestedApproaches.map((approach, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mt-0.5">
                            <span className="text-[10px] font-bold text-indigo-400">{i + 1}</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed pt-0.5">{approach}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[10px] text-zinc-600 italic flex items-center gap-1.5">
                        <Lightbulb className="w-3 h-3" />
                        Approaches are guidance only. No automatic code changes.
                      </p>
                      {onGeneratePatch && issue && (
                        <button
                          onClick={() => onGeneratePatch(issue.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-600/12 border border-indigo-500/25 rounded-xl hover:bg-indigo-600/22 hover:border-indigo-500/50 transition-all flex-shrink-0"
                        >
                          <Zap className="w-3 h-3" />
                          Generate Patch
                        </button>
                      )}
                    </div>
                  </InfoCard>
                </div>
              )}

              {/* ── Phase 14.2: Technical Analysis ── */}
              {issue.technicalDescription && (
                <div>
                  <SectionHeading icon={BookOpen} label="Technical Analysis" />
                  <InfoCard>
                    <p className="text-xs text-zinc-300 leading-relaxed">{issue.technicalDescription}</p>
                  </InfoCard>
                </div>
              )}

              {/* ── Phase 14.2: Business Impact & Risk ── */}
              {(issue.businessImpact || issue.riskClassification || issue.estimatedComplexity) && (
                <div>
                  <SectionHeading icon={TrendingUp} label="Business Impact & Risk" />
                  <InfoCard>
                    {issue.businessImpact && (
                      <p className="text-xs text-zinc-300 leading-relaxed mb-3">{issue.businessImpact}</p>
                    )}
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      {issue.riskClassification && (
                        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                          <p className="text-zinc-600 mb-1">Risk</p>
                          <span className={`font-semibold ${
                            issue.riskClassification === "critical_risk" ? "text-red-400" :
                            issue.riskClassification === "high_risk" ? "text-orange-400" :
                            issue.riskClassification === "medium_risk" ? "text-amber-400" : "text-blue-400"
                          }`}>
                            {issue.riskClassification.replace("_risk", "").replace(/^\w/, c => c.toUpperCase())}
                          </span>
                        </div>
                      )}
                      {issue.estimatedComplexity && (
                        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                          <p className="text-zinc-600 mb-1">Complexity</p>
                          <span className="font-semibold text-zinc-300">
                            {issue.estimatedComplexity.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}
                          </span>
                        </div>
                      )}
                      {issue.estimatedInvestigationHours != null && (
                        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                          <p className="text-zinc-600 mb-1">Est. Hours</p>
                          <span className="font-semibold text-zinc-300">{issue.estimatedInvestigationHours}h</span>
                        </div>
                      )}
                    </div>
                  </InfoCard>
                </div>
              )}

              {/* ── Phase 14.2: Evidence & Confidence ── */}
              {(issue.evidenceFiles?.length || issue.evidenceRefs?.length) && (
                <div>
                  <SectionHeading icon={Layers} label="Evidence & Source Files" />
                  <InfoCard>
                    {issue.evidenceFiles && issue.evidenceFiles.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Evidence Files</p>
                        <div className="space-y-1.5">
                          {issue.evidenceFiles.map(f => (
                            <div key={f} className="flex items-center gap-1.5">
                              <FileCode2 className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                              <code className="text-[11px] font-mono text-zinc-400 flex-1 truncate">{f}</code>
                              <CopyButton text={f} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {issue.evidenceRefs && issue.evidenceRefs.length > 0 && (
                      <div className={issue.evidenceFiles?.length ? "pt-3 border-t border-white/[0.04]" : ""}>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Evidence References</p>
                        <div className="space-y-1.5">
                          {issue.evidenceRefs.map(r => (
                            <code key={r} className="block text-[11px] font-mono text-zinc-500">{r}</code>
                          ))}
                        </div>
                      </div>
                    )}
                  </InfoCard>
                </div>
              )}

              {/* ── Phase 14.2: Dependency Impact ── */}
              {(issue.directImporterCount != null || issue.dependencyPaths?.length || issue.affectedRoutes?.length) && (
                <div>
                  <SectionHeading icon={Network} label="Dependency Impact" />
                  <InfoCard>
                    <div className="grid grid-cols-2 gap-3 mb-3 text-[11px]">
                      {issue.directImporterCount != null && (
                        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                          <p className="text-zinc-600 mb-1">Direct Importers</p>
                          <span className="font-semibold text-zinc-200 text-base">{issue.directImporterCount}</span>
                        </div>
                      )}
                      {issue.transitiveImporterCount != null && (
                        <div className="bg-zinc-800/60 rounded-lg p-2.5 text-center">
                          <p className="text-zinc-600 mb-1">Transitive Impact</p>
                          <span className="font-semibold text-zinc-200 text-base">{issue.transitiveImporterCount}</span>
                        </div>
                      )}
                    </div>
                    {issue.affectedRoutes && issue.affectedRoutes.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Affected Routes</p>
                        <div className="space-y-1">
                          {issue.affectedRoutes.map(r => (
                            <code key={r} className="block text-[11px] font-mono text-indigo-300 bg-indigo-500/8 border border-indigo-500/12 px-2 py-1 rounded-lg">{r}</code>
                          ))}
                        </div>
                      </div>
                    )}
                    {issue.dependencyPaths && issue.dependencyPaths.length > 0 && (
                      <div className={issue.affectedRoutes?.length ? "pt-3 border-t border-white/[0.04]" : ""}>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Dependency Paths</p>
                        <div className="space-y-1.5">
                          {issue.dependencyPaths.map(p => (
                            <div key={p} className="flex items-center gap-1.5">
                              <Hash className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                              <code className="text-[11px] font-mono text-zinc-400 truncate flex-1">{p}</code>
                              <CopyButton text={p} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </InfoCard>
                </div>
              )}

              {/* ── Phase 14.2: Related Issues ── */}
              {issue.relatedIssueIds && issue.relatedIssueIds.length > 0 && (
                <div>
                  <SectionHeading icon={Link} label="Related Issues" />
                  <InfoCard>
                    <div className="flex flex-wrap gap-2">
                      {issue.relatedIssueIds.map(rid => (
                        <code key={rid} className="text-[11px] font-mono text-indigo-300 bg-indigo-500/8 border border-indigo-500/15 px-2.5 py-1 rounded-full">
                          {rid}
                        </code>
                      ))}
                    </div>
                    {issue.analysisId && (
                      <p className="mt-3 text-[10px] text-zinc-700 font-mono">Analysis run: {issue.analysisId}</p>
                    )}
                  </InfoCard>
                </div>
              )}

              {/* ── Timeline ── */}
              <div>
                <SectionHeading icon={Clock} label="Timeline" />
                <InfoCard>
                  <div className="space-y-2.5">
                    <TimelineRow label="Detected" value={issue.createdAt} icon={AlertCircle} />
                    <TimelineRow label="Last Updated" value={issue.updatedAt} icon={Clock} />
                    {issue.resolvedAt && (
                      <TimelineRow label="Resolved" value={issue.resolvedAt} icon={CheckCircle2} color="text-emerald-400" />
                    )}
                    <TimelineRow label="Reporter" value={issue.reportedBy === "ai" ? "AI Engine" : issue.reportedBy} icon={User} raw />
                    {issue.verifiedBy && (
                      <TimelineRow label="Verified By" value={issue.verifiedBy} icon={ShieldCheck} raw color="text-blue-400" />
                    )}
                  </div>
                </InfoCard>
              </div>

              {/* Spacer */}
              <div className="h-4" />

            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TimelineRow({
  label, value, icon: Icon, raw = false, color = "text-zinc-400",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  raw?: boolean;
  color?: string;
}) {
  const display = raw ? value : new Date(value).toLocaleString();
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
      <span className="text-[11px] text-zinc-600 w-24 flex-shrink-0">{label}</span>
      <span className={`text-[11px] ${color}`}>{display}</span>
    </div>
  );
}
