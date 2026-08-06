/**
 * PatchPanel — AI Patch Generator UI
 *
 * Phase 13.3: Read-only patch proposals with approval workflow.
 * - Generate Patch: simulates AI engine processing (no code written)
 * - Explain Fix: human-readable analysis of the proposed solution
 * - View Patch: read-only diff viewer with syntax color-coding
 * - Before / After comparison: line-level diff summary
 * - Risk Assessment: overall risk + 8-dimension breakdown
 * - Human Approval Workflow: Approve / Reject — status only, no code execution
 *
 * NO code is applied. NO files are written. NO builds are triggered.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Zap, FileCode2, AlertCircle, AlertTriangle, Info,
  CheckCircle2, Minus, Copy, Check, ChevronDown, Search,
  Maximize2, Shield, ThumbsUp, ThumbsDown, Clock, User,
  FileText, Layers, RefreshCw, Code2, ArrowRight,
  ShieldAlert, ShieldCheck, RotateCcw, Hash, Plus, Minus as MinusIcon,
  Wrench, AlertOctagon,
} from "lucide-react";
import {
  patchService,
  type PatchProposal,
  type PatchApprovalStatus,
  type PatchRiskLevel,
  type PatchComplexity,
  type PatchFile,
  type PatchDiffLine,
} from "../../services/patchService";
import type { IssueSeverity, IssueLayer } from "../../services/developerService";

// ─── Config maps ──────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<IssueSeverity, { label: string; classes: string; dot: string }> = {
  critical:      { label: "Critical",      classes: "bg-red-500/12 text-red-400 border-red-500/20",          dot: "bg-red-500" },
  high:          { label: "High",          classes: "bg-orange-500/12 text-orange-400 border-orange-500/20", dot: "bg-orange-500" },
  medium:        { label: "Medium",        classes: "bg-amber-500/12 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  low:           { label: "Low",           classes: "bg-blue-500/12 text-blue-400 border-blue-500/20",       dot: "bg-blue-400" },
  informational: { label: "Info",          classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20",       dot: "bg-zinc-500" },
};

const RISK_CONFIG: Record<PatchRiskLevel, { label: string; classes: string; bar: string }> = {
  very_low: { label: "Very Low",  classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20", bar: "bg-emerald-500" },
  low:      { label: "Low",       classes: "bg-blue-500/12 text-blue-400 border-blue-500/20",          bar: "bg-blue-500" },
  medium:   { label: "Medium",    classes: "bg-amber-500/12 text-amber-400 border-amber-500/20",       bar: "bg-amber-400" },
  high:     { label: "High",      classes: "bg-orange-500/12 text-orange-400 border-orange-500/20",    bar: "bg-orange-500" },
  critical: { label: "Critical",  classes: "bg-red-500/12 text-red-400 border-red-500/20",             bar: "bg-red-500" },
};

const APPROVAL_CONFIG: Record<PatchApprovalStatus, { label: string; classes: string; icon: React.ElementType }> = {
  pending_review: { label: "Pending Review", classes: "bg-amber-500/12 text-amber-400 border-amber-500/20", icon: Clock },
  approved:       { label: "Approved",       classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20", icon: ShieldCheck },
  rejected:       { label: "Rejected",       classes: "bg-red-500/12 text-red-400 border-red-500/20", icon: ShieldAlert },
};

const COMPLEXITY_CONFIG: Record<PatchComplexity, { label: string; classes: string }> = {
  trivial:      { label: "Trivial",      classes: "text-emerald-400" },
  simple:       { label: "Simple",       classes: "text-blue-400" },
  moderate:     { label: "Moderate",     classes: "text-amber-400" },
  complex:      { label: "Complex",      classes: "text-orange-400" },
  very_complex: { label: "Very Complex", classes: "text-red-400" },
};

const LAYER_LABELS: Record<IssueLayer, string> = {
  frontend: "Frontend", backend: "Backend", database: "Database",
  api: "API", infrastructure: "Infrastructure", security: "Security", performance: "Performance",
};

const RISK_ORDER: PatchRiskLevel[] = ["very_low", "low", "medium", "high", "critical"];
const riskScore = (r: PatchRiskLevel) => RISK_ORDER.indexOf(r);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type PatchTab = "overview" | "diff" | "risk" | "approval";

const TABS: { id: PatchTab; label: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview",   icon: FileText },
  { id: "diff",      label: "View Patch", icon: Code2 },
  { id: "risk",      label: "Risk",       icon: Shield },
  { id: "approval",  label: "Approval",   icon: ShieldCheck },
];

// ─── Small utilities ──────────────────────────────────────────────────────────

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  const sz = small ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <button onClick={copy} className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0" title="Copy">
      {copied ? <Check className={`${sz} text-emerald-400`} /> : <Copy className={sz} />}
    </button>
  );
}

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const color = value >= 90 ? "bg-emerald-500" : value >= 75 ? "bg-amber-400" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[11px] text-zinc-500 w-16 flex-shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-zinc-300 tabular-nums w-9 text-right">{value}%</span>
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

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase mb-2">{label}</p>;
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function DiffLineRow({ line }: { line: PatchDiffLine }) {
  if (line.type === "hunk") {
    return (
      <div className="flex items-center gap-0 bg-indigo-950/30 border-y border-indigo-900/30 text-[10px] font-mono text-indigo-400 px-3 py-1 select-none">
        <span>{line.content}</span>
      </div>
    );
  }

  const bgClass = line.type === "added"
    ? "bg-emerald-950/30 hover:bg-emerald-950/50"
    : line.type === "removed"
    ? "bg-red-950/25 hover:bg-red-950/40"
    : "hover:bg-white/[0.02]";

  const prefixClass = line.type === "added"
    ? "text-emerald-500"
    : line.type === "removed"
    ? "text-red-500"
    : "text-zinc-700";

  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "−" : " ";

  const lineNumClass = "text-zinc-700 select-none text-right tabular-nums w-9 flex-shrink-0 text-[10px]";

  return (
    <div className={`flex items-start gap-0 group transition-colors ${bgClass}`}>
      <span className={`${lineNumClass} px-2 py-0.5`}>{line.lineNumBefore ?? " "}</span>
      <span className={`${lineNumClass} px-2 py-0.5`}>{line.lineNumAfter ?? " "}</span>
      <span className={`w-5 flex-shrink-0 py-0.5 text-center text-[11px] font-bold ${prefixClass}`}>{prefix}</span>
      <code className="flex-1 py-0.5 pr-3 text-[11px] font-mono text-zinc-300 whitespace-pre overflow-x-auto leading-5">
        {line.content}
      </code>
    </div>
  );
}

function FileCard({
  file, expanded, onToggle, search,
}: {
  file: PatchFile;
  expanded: boolean;
  onToggle: () => void;
  search: string;
}) {
  const filteredLines = search
    ? file.diff.filter(l => l.content.toLowerCase().includes(search.toLowerCase()) || l.type === "hunk")
    : file.diff;

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* File header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/80 hover:bg-zinc-800/60 transition-colors text-left"
      >
        <FileCode2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
        <code className="flex-1 text-[11px] font-mono text-zinc-300 min-w-0 truncate">{file.filePath}</code>
        <div className="flex items-center gap-2 flex-shrink-0">
          {file.linesAdded > 0 && (
            <span className="text-[10px] font-semibold text-emerald-400">+{file.linesAdded}</span>
          )}
          {file.linesRemoved > 0 && (
            <span className="text-[10px] font-semibold text-red-400">−{file.linesRemoved}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Diff lines */}
      {expanded && (
        <div className="border-t border-white/[0.04] overflow-x-auto">
          <div className="min-w-0">
            {filteredLines.length === 0 ? (
              <p className="text-xs text-zinc-600 p-4 text-center">No lines match your search.</p>
            ) : (
              filteredLines.map((line, i) => <DiffLineRow key={i} line={line} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function OverviewTab({ patch }: { patch: PatchProposal }) {
  const sev = SEVERITY_CONFIG[patch.severity];
  const risk = RISK_CONFIG[patch.riskAssessment.overall];
  const complexity = COMPLEXITY_CONFIG[patch.estimatedComplexity];

  return (
    <div className="p-6 space-y-5">
      {/* Identity header */}
      <InfoCard>
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-[11px] text-zinc-500">{patch.id}</span>
              <ArrowRight className="w-3 h-3 text-zinc-700" />
              <span className="font-mono text-[11px] text-zinc-500">{patch.issueId}</span>
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug">{patch.title}</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <SectionLabel label="Severity" />
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${sev.classes}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
              {sev.label}
            </span>
          </div>
          <div>
            <SectionLabel label="Overall Risk" />
            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${risk.classes}`}>
              {risk.label}
            </span>
          </div>
          <div>
            <SectionLabel label="Complexity" />
            <span className={`text-xs font-semibold ${complexity.classes}`}>{complexity.label}</span>
          </div>
          <div>
            <SectionLabel label="Confidence" />
            <span className="text-xs font-semibold text-zinc-300">{patch.confidence}%</span>
          </div>
        </div>
      </InfoCard>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Files Changed",   value: patch.totalFilesAffected, icon: FileCode2,   color: "text-indigo-400" },
          { label: "Lines Added",     value: `+${patch.totalLinesAdded}`,   icon: Plus,        color: "text-emerald-400" },
          { label: "Lines Removed",   value: `-${patch.totalLinesRemoved}`, icon: MinusIcon,   color: "text-red-400" },
        ].map(s => (
          <InfoCard key={s.label}>
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-zinc-600">{s.label}</p>
          </InfoCard>
        ))}
      </div>

      {/* Location */}
      <div>
        <SectionLabel label="Location" />
        <InfoCard>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <div>
              <p className="text-zinc-600 mb-0.5">Layer</p>
              <span className="text-zinc-300 font-medium">{LAYER_LABELS[patch.affectedLayer]}</span>
            </div>
            <div>
              <p className="text-zinc-600 mb-0.5">Module</p>
              <code className="font-mono text-indigo-300">{patch.affectedModule}</code>
            </div>
          </div>
          {patch.affectedFile && (
            <div className="mt-3 pt-3 border-t border-white/[0.04]">
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded-lg flex-1 break-all">
                  {patch.affectedFile}{patch.affectedLine ? `:${patch.affectedLine}` : ""}
                </code>
                <CopyButton text={patch.affectedFile + (patch.affectedLine ? `:${patch.affectedLine}` : "")} />
              </div>
            </div>
          )}
        </InfoCard>
      </div>

      {/* Summary */}
      <div>
        <SectionLabel label="Summary" />
        <InfoCard>
          <p className="text-xs text-zinc-300 leading-relaxed">{patch.summary}</p>
        </InfoCard>
      </div>

      {/* Proposed solution */}
      <div>
        <SectionLabel label="Proposed Solution" />
        <InfoCard>
          <p className="text-xs text-zinc-300 leading-relaxed">{patch.proposedSolution}</p>
        </InfoCard>
      </div>

      {/* Expected result */}
      <div>
        <SectionLabel label="Expected Result" />
        <InfoCard className="border-emerald-500/10">
          <div className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-300 leading-relaxed">{patch.expectedResult}</p>
          </div>
        </InfoCard>
      </div>

      {/* Explain Fix */}
      <div>
        <SectionLabel label="Explain Fix" />
        <InfoCard>
          <div className="space-y-4 text-xs">
            <div>
              <p className="text-zinc-500 font-medium mb-1">Why does this issue exist?</p>
              <p className="text-zinc-300 leading-relaxed">{patch.explainFix.whyIssueExists}</p>
            </div>
            <div className="border-t border-white/[0.04] pt-3">
              <p className="text-zinc-500 font-medium mb-1">Why does it happen?</p>
              <p className="text-zinc-300 leading-relaxed">{patch.explainFix.whyItHappens}</p>
            </div>
            <div className="border-t border-white/[0.04] pt-3">
              <p className="text-zinc-500 font-medium mb-1">Why does the proposed solution solve it?</p>
              <p className="text-zinc-300 leading-relaxed">{patch.explainFix.whySolutionWorks}</p>
            </div>

            {patch.explainFix.possibleSideEffects.length > 0 && (
              <div className="border-t border-white/[0.04] pt-3">
                <p className="text-zinc-500 font-medium mb-2">Possible Side Effects</p>
                <ul className="space-y-1.5">
                  {patch.explainFix.possibleSideEffects.map((s, i) => (
                    <li key={i} className="flex gap-2 text-zinc-400">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patch.explainFix.possibleAlternatives.length > 0 && (
              <div className="border-t border-white/[0.04] pt-3">
                <p className="text-zinc-500 font-medium mb-2">Possible Alternatives</p>
                <ul className="space-y-1.5">
                  {patch.explainFix.possibleAlternatives.map((a, i) => (
                    <li key={i} className="flex gap-2 text-zinc-400">
                      <span className="text-indigo-400 mt-0.5 flex-shrink-0">◦</span>
                      <span className="leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patch.explainFix.tradeoffs.length > 0 && (
              <div className="border-t border-white/[0.04] pt-3">
                <p className="text-zinc-500 font-medium mb-2">Trade-offs</p>
                <ul className="space-y-1.5">
                  {patch.explainFix.tradeoffs.map((t, i) => (
                    <li key={i} className="flex gap-2 text-zinc-400">
                      <span className="text-zinc-500 mt-0.5 flex-shrink-0">↔</span>
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patch.explainFix.dependencies.length > 0 && (
              <div className="border-t border-white/[0.04] pt-3">
                <p className="text-zinc-500 font-medium mb-2">Dependencies</p>
                <div className="space-y-1.5">
                  {patch.explainFix.dependencies.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                      <code className="text-[11px] font-mono text-zinc-400">{d}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.04] pt-3">
              <p className="text-zinc-500 font-medium mb-1">Expected Outcome</p>
              <p className="text-zinc-300 leading-relaxed">{patch.explainFix.expectedOutcome}</p>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Attribution */}
      <InfoCard>
        <div className="flex items-center gap-4 text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Generated by: <span className="text-zinc-400 font-medium ml-0.5">{patch.generatedBy === "ai" ? "AI Engine" : patch.generatedBy}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {new Date(patch.generatedAt).toLocaleString()}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-zinc-700 italic border-t border-white/[0.04] pt-2">
          This is a read-only patch proposal. No code has been applied to the project. Phase 13.4 (Fix Engine) reads approved proposals to execute changes.
        </p>
      </InfoCard>

      <div className="h-4" />
    </div>
  );
}

function DiffTab({ patch }: { patch: PatchProposal }) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    () => new Set(patch.files.map(f => f.filePath))
  );
  const [search, setSearch] = useState("");

  const toggleFile = (path: string) =>
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });

  const expandAll  = () => setExpandedFiles(new Set(patch.files.map(f => f.filePath)));
  const collapseAll = () => setExpandedFiles(new Set());

  const allText = patch.files.flatMap(f => f.diff.map(l => l.content)).join("\n");

  return (
    <div className="p-6 space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search in patch…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-xs bg-zinc-900 border border-white/[0.07] rounded-xl text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button onClick={expandAll}   className="px-3 py-2 text-xs text-zinc-400 border border-zinc-700 rounded-xl hover:border-zinc-500 hover:text-zinc-200 transition-all flex items-center gap-1.5">
          <Maximize2 className="w-3 h-3" /> Expand All
        </button>
        <button onClick={collapseAll} className="px-3 py-2 text-xs text-zinc-400 border border-zinc-700 rounded-xl hover:border-zinc-500 hover:text-zinc-200 transition-all">
          Collapse All
        </button>
        <div className="flex items-center gap-2">
          <CopyButton text={allText} />
          <span className="text-[11px] text-zinc-600">Copy patch</span>
        </div>
      </div>

      {/* Before / After summary bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-emerald-400">+{patch.totalLinesAdded}</span>
          <span className="text-[11px] text-zinc-600">lines added</span>
        </div>
        <div className="w-px h-3 bg-zinc-800" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-red-400">−{patch.totalLinesRemoved}</span>
          <span className="text-[11px] text-zinc-600">lines removed</span>
        </div>
        <div className="w-px h-3 bg-zinc-800" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-300">{patch.totalFilesAffected}</span>
          <span className="text-[11px] text-zinc-600">{patch.totalFilesAffected === 1 ? "file" : "files"} changed</span>
        </div>
        <div className="ml-auto text-[10px] text-zinc-700 font-medium">READ ONLY — No code applied</div>
      </div>

      {/* File diffs */}
      <div className="space-y-3">
        {patch.files.map(file => (
          <FileCard
            key={file.filePath}
            file={file}
            expanded={expandedFiles.has(file.filePath)}
            onToggle={() => toggleFile(file.filePath)}
            search={search}
          />
        ))}
      </div>

      <div className="h-4" />
    </div>
  );
}

function RiskTab({ patch }: { patch: PatchProposal }) {
  const risk = RISK_CONFIG[patch.riskAssessment.overall];
  const sortedDimensions = [...patch.riskAssessment.dimensions].sort(
    (a, b) => riskScore(b.level) - riskScore(a.level)
  );

  return (
    <div className="p-6 space-y-5">
      {/* Overall risk */}
      <InfoCard>
        <div className="flex items-start gap-4">
          <div className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${risk.classes} flex-shrink-0`}>
            {risk.label} Risk
          </div>
          <div className="flex-1">
            <p className="text-xs text-zinc-400 leading-relaxed">{patch.riskAssessment.overallReason}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.04]">
          <ConfidenceBar value={patch.riskAssessment.confidence} label="Confidence" />
        </div>
      </InfoCard>

      {/* Risk dimensions */}
      <div>
        <SectionLabel label="Risk Dimensions" />
        <div className="space-y-2.5">
          {sortedDimensions.map((dim) => {
            const rCfg = RISK_CONFIG[dim.level];
            return (
              <InfoCard key={dim.area}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-28">
                    <p className="text-[11px] font-semibold text-zinc-400 mb-1.5">{dim.area}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${rCfg.classes}`}>
                      {rCfg.label}
                    </span>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-xs text-zinc-500 leading-relaxed">{dim.reason}</p>
                  </div>
                </div>
              </InfoCard>
            );
          })}
        </div>
      </div>

      {/* Affected systems */}
      {patch.explainFix.affectedSystems.length > 0 && (
        <div>
          <SectionLabel label="Affected Systems" />
          <InfoCard>
            <div className="flex flex-wrap gap-2">
              {patch.explainFix.affectedSystems.map((sys, i) => (
                <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-zinc-800/60 text-zinc-400 border-zinc-700">
                  {sys}
                </span>
              ))}
            </div>
          </InfoCard>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

function ApprovalTab({
  patch, onApprove, onReject, approving, rejecting, onApplyFix,
}: {
  patch: PatchProposal;
  onApprove: () => void;
  onReject: (reason: string) => void;
  approving: boolean;
  rejecting: boolean;
  onApplyFix?: (patch: PatchProposal) => void;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const approvalCfg = APPROVAL_CONFIG[patch.approvalStatus];
  const ApprovalIcon = approvalCfg.icon;
  const isBusy = approving || rejecting;

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(rejectionReason.trim());
    setShowRejectForm(false);
    setRejectionReason("");
  };

  return (
    <div className="p-6 space-y-5">
      {/* Current status */}
      <InfoCard>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${approvalCfg.classes}`}>
            <ApprovalIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Workflow Status</p>
            <p className={`text-sm font-bold ${approvalCfg.classes.split(" ").find(c => c.startsWith("text-")) ?? "text-zinc-300"}`}>
              {approvalCfg.label}
            </p>
          </div>
        </div>

        {patch.approvalStatus === "approved" && (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-zinc-500">
              <User className="w-3 h-3" />
              Approved by <span className="text-zinc-300 font-medium ml-0.5">{patch.approvedBy}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <Clock className="w-3 h-3" />
              {patch.approvedAt ? new Date(patch.approvedAt).toLocaleString() : "—"}
            </div>
          </div>
        )}

        {patch.approvalStatus === "rejected" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <User className="w-3 h-3" />
              Rejected by <span className="text-zinc-300 font-medium ml-0.5">{patch.rejectedBy}</span>
            </div>
            {patch.rejectionReason && (
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/30">
                <p className="text-[11px] text-zinc-500 mb-1">Rejection reason:</p>
                <p className="text-xs text-red-300 leading-relaxed">{patch.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </InfoCard>

      {/* Approval guidance */}
      <InfoCard>
        <p className="text-xs font-semibold text-zinc-300 mb-2">Before you approve</p>
        <ul className="space-y-1.5 text-xs text-zinc-500">
          <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" /> Review the proposed diff in the View Patch tab</li>
          <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" /> Verify the risk assessment aligns with your team's tolerance</li>
          <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" /> Confirm the expected result matches the intent</li>
          <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" /> Check for any dependencies that may need coordinated changes</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <p className="text-[10px] text-zinc-600 italic">
            Approval changes the workflow status only. No code is applied to the project.
            Phase 13.4 (Fix Engine) reads approved proposals to execute changes under human supervision.
          </p>
        </div>
      </InfoCard>

      {/* Action buttons — only shown for pending_review */}
      {patch.approvalStatus === "pending_review" && (
        <div className="space-y-3">
          {/* Approve */}
          <button
            onClick={onApprove}
            disabled={isBusy || showRejectForm}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-600/25 hover:border-emerald-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {approving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
            {approving ? "Approving…" : "Approve Patch"}
          </button>

          {/* Reject */}
          {!showRejectForm ? (
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={isBusy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-600/20 hover:border-red-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ThumbsDown className="w-4 h-4" /> Reject Patch
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-4 space-y-3">
              <p className="text-xs font-semibold text-red-300">Rejection reason</p>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why this patch is being rejected…"
                rows={3}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || rejecting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600/15 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rejecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                  {rejecting ? "Rejecting…" : "Confirm Reject"}
                </button>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectionReason(""); }}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-500 hover:text-zinc-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Re-open if rejected */}
      {patch.approvalStatus === "rejected" && (
        <button
          onClick={onApprove}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:border-zinc-500 hover:text-zinc-100 transition-all disabled:opacity-40"
        >
          <RotateCcw className="w-4 h-4" /> Re-open as Approved
        </button>
      )}

      {/* ── Apply Fix block — Phase 13.4 (only for approved patches) ── */}
      {patch.approvalStatus === "approved" && onApplyFix && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-1">Fix Engine — Phase 13.4</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                This patch is approved. The Fix Engine will simulate applying the proposed
                changes to the project files, run the build, compile TypeScript, and verify
                all platform systems. Human approval has already been granted.
              </p>
            </div>
          </div>
          <button
            onClick={() => onApplyFix(patch)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/15 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-600/25 hover:border-amber-500/60 transition-all"
          >
            <Wrench className="w-4 h-4" /> Apply Fix
          </button>
          <p className="text-[10px] text-zinc-700 italic text-center">
            No rollback available in Phase 13.4. Phase 13.5 provides rollback and version history.
          </p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

// ─── Generate screen ──────────────────────────────────────────────────────────

function GenerateScreen({
  issueId, generating, hasNoSample, onGenerate,
}: {
  issueId: string;
  generating: boolean;
  hasNoSample: boolean;
  onGenerate: () => void;
}) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    if (!generating) return;
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(iv);
  }, [generating]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
      {generating ? (
        <>
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center mb-5 animate-pulse">
            <Zap className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-zinc-200 mb-1">Generating patch proposal{dots}</p>
          <p className="text-xs text-zinc-500 max-w-xs">
            AI engine is analysing {issueId} — examining the affected files, generating a proposed solution, assessing risk, and preparing the explanation.
          </p>
          <div className="mt-6 flex gap-1.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </>
      ) : hasNoSample ? (
        <>
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700 flex items-center justify-center mb-4">
            <Code2 className="w-6 h-6 text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-zinc-300 mb-2">No patch data available</p>
          <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
            The AI engine does not have a pre-generated patch for this issue yet. Generation with a live AI engine is a Phase 13.4+ feature.
          </p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/12 border border-indigo-500/15 flex items-center justify-center mb-5">
            <Zap className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-zinc-200 mb-2">Generate Patch Proposal</p>
          <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mb-6">
            The AI engine will analyse {issueId} and produce a fully documented patch proposal — including the proposed diff, risk assessment, explanation, and approval workflow. No code will be modified.
          </p>
          <button
            onClick={onGenerate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 text-sm font-semibold hover:bg-indigo-600/25 hover:border-indigo-500/60 transition-all"
          >
            <Zap className="w-4 h-4" /> Generate Patch
          </button>
          <p className="mt-4 text-[10px] text-zinc-700 italic">
            No code will be applied. No files will be modified. Proposal is read-only.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface PatchPanelProps {
  issueId: string | null;
  onClose: () => void;
  onPatchUpdate?: (updated: PatchProposal) => void;
  onApplyFix?: (patch: PatchProposal) => void;
}

export function PatchPanel({ issueId, onClose, onPatchUpdate, onApplyFix }: PatchPanelProps) {
  const [patch,      setPatch]      = useState<PatchProposal | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasNoSample,setHasNoSample]= useState(false);
  const [activeTab,  setActiveTab]  = useState<PatchTab>("overview");
  const [approving,  setApproving]  = useState(false);
  const [rejecting,  setRejecting]  = useState(false);

  const isOpen = issueId !== null;

  // Load existing patch when issueId changes
  useEffect(() => {
    if (!issueId) {
      setPatch(null);
      setHasNoSample(false);
      setActiveTab("overview");
      return;
    }
    setLoading(true);
    patchService.fetchPatchByIssueId(issueId).then(p => {
      setPatch(p);
      setHasNoSample(false);
      setLoading(false);
    });
  }, [issueId]);

  const handleGenerate = useCallback(async () => {
    if (!issueId || generating) return;
    setGenerating(true);
    const result = await patchService.generatePatch(issueId);
    setGenerating(false);
    if (result) {
      setPatch(result);
    } else {
      setHasNoSample(true);
    }
  }, [issueId, generating]);

  const handleApprove = useCallback(async () => {
    if (!patch || approving) return;
    setApproving(true);
    const updated = await patchService.approvePatch(patch.id, "admin");
    setApproving(false);
    if (updated) {
      setPatch(updated);
      onPatchUpdate?.(updated);
    }
  }, [patch, approving, onPatchUpdate]);

  const handleReject = useCallback(async (reason: string) => {
    if (!patch || rejecting) return;
    setRejecting(true);
    const updated = await patchService.rejectPatch(patch.id, "admin", reason);
    setRejecting(false);
    if (updated) {
      setPatch(updated);
      onPatchUpdate?.(updated);
    }
  }, [patch, rejecting, onPatchUpdate]);

  const approvalCfg = patch ? APPROVAL_CONFIG[patch.approvalStatus] : null;
  const ApprovalIcon = approvalCfg?.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Modal — slides up from bottom on mobile, centered on desktop */}
      <div
        className={`
          fixed z-60 flex flex-col
          inset-x-0 bottom-0 top-0
          md:inset-x-auto md:left-1/2 md:-translate-x-1/2
          md:top-1/2 md:-translate-y-1/2
          md:w-[min(90vw,1024px)] md:h-[min(90vh,860px)]
          md:rounded-2xl
          bg-[#0e0e12] border border-white/[0.07] shadow-2xl
          transition-all duration-300 ease-out
          ${isOpen ? "opacity-100 translate-y-0 md:scale-100" : "opacity-0 translate-y-8 md:scale-95 pointer-events-none"}
        `}
        style={{ zIndex: 60 }}
      >
        {/* ── Modal header ── */}
        <div className="flex-shrink-0 border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-zinc-100">AI Patch Generator</p>
              {issueId && (
                <span className="font-mono text-[11px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">{issueId}</span>
              )}
              {patch && approvalCfg && ApprovalIcon && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${approvalCfg.classes}`}>
                  <ApprovalIcon className="w-2.5 h-2.5" />
                  {approvalCfg.label}
                </span>
              )}
            </div>
            {patch && (
              <p className="text-[11px] text-zinc-500 truncate mt-0.5 leading-tight">{patch.id} — {patch.title}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tab bar (only when patch is loaded) ── */}
        {patch && (
          <div className="flex-shrink-0 flex items-center gap-0 border-b border-white/[0.06] px-6 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? "text-indigo-300 border-indigo-500"
                      : "text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === "approval" && patch.approvalStatus === "pending_review" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-zinc-800/50 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : !patch ? (
            <GenerateScreen
              issueId={issueId ?? ""}
              generating={generating}
              hasNoSample={hasNoSample}
              onGenerate={handleGenerate}
            />
          ) : (
            <>
              {activeTab === "overview"  && <OverviewTab  patch={patch} />}
              {activeTab === "diff"      && <DiffTab      patch={patch} />}
              {activeTab === "risk"      && <RiskTab      patch={patch} />}
              {activeTab === "approval"  && (
                <ApprovalTab
                  patch={patch}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  approving={approving}
                  rejecting={rejecting}
                  onApplyFix={onApplyFix}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
