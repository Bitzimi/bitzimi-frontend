import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, ExternalLink, CheckCircle2, XCircle, DollarSign,
  Layers, Clock, AlertTriangle, ChevronDown, ChevronUp, Bot,
} from "lucide-react";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { adminTaskService, type AdminTaskDetail, type AdminTaskProofItem } from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { can } = useAdminAccess();

  const [task, setTask] = useState<AdminTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProofs, setExpandedProofs] = useState<Set<string>>(new Set());

  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    const data = await adminTaskService.getTaskDetail(taskId);
    setTask(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    if (!taskId) return;
    setSubmitting(true);
    await adminTaskService.approveTask(taskId);
    setConfirmAction(null);
    setSubmitting(false);
    load();
  };

  const handleReject = async () => {
    if (!taskId || !rejectReason.trim()) return;
    setSubmitting(true);
    await adminTaskService.rejectTask(taskId, rejectReason.trim());
    setConfirmAction(null);
    setRejectReason("");
    setSubmitting(false);
    load();
  };

  const toggleProof = (id: string) => {
    setExpandedProofs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confidenceColor = (n: number | null) => {
    if (n === null) return "text-zinc-500";
    return n >= 85 ? "text-emerald-400" : n >= 70 ? "text-amber-400" : "text-red-400";
  };

  const proofStatusLabel: Record<string, string> = {
    pending:         "Pending",
    ai_approved:     "AI Approved",
    ai_rejected:     "AI Rejected",
    admin_approved:  "Admin Approved",
    admin_rejected:  "Admin Rejected",
    in_review:       "In Review",
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-12 rounded-xl bg-zinc-800/30 animate-pulse" />
        <div className="h-36 rounded-2xl bg-zinc-800/30 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 rounded-2xl bg-zinc-800/30 animate-pulse" />
          <div className="h-28 rounded-2xl bg-zinc-800/30 animate-pulse" />
        </div>
        <div className="h-64 rounded-2xl bg-zinc-800/30 animate-pulse" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-10 text-center">
          <p className="text-zinc-400 text-sm">Task not found or you do not have permission to view it.</p>
        </div>
      </div>
    );
  }

  const totalBudget = task.totalBudget ?? 0;
  const budgetSpent = task.budgetSpent ?? 0;
  const budgetRemaining = task.budgetRemaining ?? 0;
  const budgetPct = totalBudget > 0 ? (budgetSpent / totalBudget) * 100 : 0;
  const slotPct = task.totalSlots > 0 ? (task.completedSlots / task.totalSlots) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Task header */}
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{task.title}</h1>
              <StatusBadge status={task.status} size="md" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">
              Advertiser: <span className="text-zinc-300">{task.advertiserName}</span>
              {" · "}
              Type: <span className="text-zinc-300 capitalize">{task.type}</span>
              {" · "}
              Created: <span className="text-zinc-300">{new Date(task.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
            </p>
            {task.approvedAt && (
              <p className="text-xs text-emerald-500">
                Approved {new Date(task.approvedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </p>
            )}
            {task.rejectedAt && (
              <p className="text-xs text-red-400">
                Rejected {new Date(task.rejectedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                {task.rejectionReason ? ` — ${task.rejectionReason}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={task.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Visit Link
            </a>
          </div>
        </div>
      </div>

      {/* Approve / reject banner */}
      {task.status === "pending_review" && (can("admin.tasks.approve") || can("admin.tasks.reject")) && (
        <div className="rounded-2xl bg-amber-500/[0.07] border border-amber-500/20 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Awaiting Review</p>
              <p className="text-xs text-zinc-400">This task is pending your approval before going live in the marketplace.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {can("admin.tasks.reject") && (
              <button
                onClick={() => { setRejectReason(""); setConfirmAction("reject"); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-all text-sm font-medium"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}
            {can("admin.tasks.approve") && (
              <button
                onClick={() => setConfirmAction("approve")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 transition-all text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
            )}
          </div>
        </div>
      )}

      {/* Budget + Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Budget</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Total Budget</span>
              <span className="text-white font-semibold tabular-nums">${totalBudget.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Spent</span>
              <span className="text-white tabular-nums">${budgetSpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Remaining</span>
              <span className="text-emerald-400 font-semibold tabular-nums">${budgetRemaining.toFixed(2)}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
                <span>Utilization</span>
                <span>{budgetPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 pt-1 border-t border-white/[0.04]">
              <span>Reward/slot</span>
              <span className="text-zinc-300 tabular-nums">${task.totalReward?.toFixed(4)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Slot Progress</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Total Slots</span>
              <span className="text-white font-semibold tabular-nums">{task.totalSlots}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Completed</span>
              <span className="text-white tabular-nums">{task.completedSlots}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Remaining</span>
              <span className="text-emerald-400 font-semibold tabular-nums">{task.remainingSlots}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
                <span>Fill Rate</span>
                <span>{slotPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-teal-500 transition-all"
                  style={{ width: `${Math.min(slotPct, 100)}%` }}
                />
              </div>
            </div>
            {task.expiresAt && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-1 border-t border-white/[0.04]">
                <Clock className="w-3 h-3" />
                <span>Expires {new Date(task.expiresAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task details */}
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Task Details</h3>
        {task.instructions && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Description</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{task.instructions}</p>
          </div>
        )}
        {task.proofInstructions && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Proof Instructions</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{task.proofInstructions}</p>
          </div>
        )}
        {task.referenceScreenshotUrls?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Reference Screenshots</p>
            <div className="flex gap-3 flex-wrap">
              {task.referenceScreenshotUrls.map((url, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 w-40">
                  <img src={url} alt={`Reference ${i + 1}`} className="w-full h-24 object-cover" />
                  <p className="text-[10px] text-zinc-600 px-2 py-1">Ref {i + 1}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proof submissions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
          Proof Submissions ({task.proofs?.length ?? 0})
        </h3>
        {!task.proofs?.length ? (
          <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-8 text-center">
            <p className="text-sm text-zinc-500">No proof submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {task.proofs.map((proof: AdminTaskProofItem) => {
              const isExpanded = expandedProofs.has(proof.id);
              return (
                <div key={proof.id} className="rounded-2xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
                  <button
                    onClick={() => toggleProof(proof.id)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge status={proof.status} />
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-white truncate">
                          {proof.username || proof.userId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {new Date(proof.submittedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {proof.aiConfidence !== null && (
                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${confidenceColor(proof.aiConfidence)}`}>
                          <Bot className="w-3.5 h-3.5" />
                          {proof.aiConfidence}%
                        </div>
                      )}
                      {proof.rewardAmount !== null && (
                        <p className="text-sm font-semibold text-zinc-300 tabular-nums">
                          ${proof.rewardAmount.toFixed(4)}
                        </p>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-zinc-500" />
                        : <ChevronDown className="w-4 h-4 text-zinc-500" />
                      }
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.05] px-5 py-4 space-y-4">
                      <div className="flex items-center gap-4 flex-wrap text-xs text-zinc-500">
                        <span>Status: <span className="text-zinc-300">{proofStatusLabel[proof.status] ?? proof.status}</span></span>
                        {proof.rewardPaid && <span className="text-emerald-400 font-medium">Reward paid</span>}
                        {proof.processedAt && (
                          <span>Processed: <span className="text-zinc-300">{new Date(proof.processedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span></span>
                        )}
                      </div>

                      {proof.aiAnalysis && (
                        <div className="rounded-xl bg-zinc-900/50 border border-white/[0.04] px-4 py-3">
                          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Bot className="w-3 h-3" />
                            AI Analysis
                          </p>
                          <p className="text-xs text-zinc-300 leading-relaxed">{proof.aiAnalysis}</p>
                        </div>
                      )}

                      {proof.screenshotUrls?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Screenshots</p>
                          <div className="flex gap-3 flex-wrap">
                            {proof.screenshotUrls.map((url, i) => (
                              <div key={i} className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 w-40">
                                <img src={url} alt={`Screenshot ${i + 1}`} className="w-full h-24 object-cover" />
                                <p className="text-[10px] text-zinc-600 px-2 py-1">Screenshot {i + 1}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        variant="success"
        title="Approve this task?"
        message={`"${task.title}" will become active and visible in the marketplace. Workers can begin submitting proofs.`}
        confirmLabel="Approve Task"
        onConfirm={handleApprove}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        variant="danger"
        title="Reject this task?"
        message={`The advertiser's budget of $${totalBudget.toFixed(2)} will be refunded to their main wallet. They will be notified.`}
        confirmLabel="Reject & Refund"
        noteLabel="Rejection reason (required)"
        noteValue={rejectReason}
        onNoteChange={setRejectReason}
        onConfirm={handleReject}
        onCancel={() => { setConfirmAction(null); setRejectReason(""); }}
      />

      {/* suppress unused var warning */}
      {submitting && null}
    </div>
  );
}
