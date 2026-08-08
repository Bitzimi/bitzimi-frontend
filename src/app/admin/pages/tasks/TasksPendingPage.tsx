import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ClipboardCheck, CheckCircle2, XCircle, ExternalLink, ImageIcon } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { adminTaskService } from "../../services/adminDataService";
import type { Task } from "../../../pages/Tasks";
import { CategoryIcon } from "../../../pages/Tasks";

export default function TasksPendingPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    taskId: string; action: "approve" | "reject"; task: Task;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = async () => {
    setLoading(true);
    setTasks(await adminTaskService.getPendingTasks());
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.action === "approve") {
      await adminTaskService.approveTask(confirmAction.taskId);
    } else {
      await adminTaskService.rejectTask(confirmAction.taskId, rejectNote || "Did not meet requirements");
    }
    setConfirmAction(null);
    setRejectNote("");
    load();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-16 bg-zinc-800/50 rounded-2xl animate-pulse" />
        <div className="h-96 bg-zinc-800/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Task Approval Queue"
        description="Review task campaigns submitted by advertisers. Approved tasks go live in the marketplace."
        badge={tasks.length > 0 ? { label: `${tasks.length} pending`, variant: "warning" } : undefined}
      />

      {tasks.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={ClipboardCheck}
            title="No tasks pending approval"
            description="All task campaigns have been reviewed. New submissions will appear here."
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <div
              key={task.id}
              className="rounded-2xl bg-[#18181b] border border-white/[0.06] overflow-hidden"
            >
              {/* Campaign image if present */}
              {task.campaignImageUrl && (
                <div className="h-24 overflow-hidden">
                  <img src={task.campaignImageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <CategoryIcon categoryId={task.type} size={18} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{task.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        by <span className="text-zinc-400">{task.advertiserName}</span>
                        {" · "}
                        {new Date(task.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status="pending" label="Pending Review" />
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total Budget", value: `$${task.totalBudget.toFixed(2)}` },
                    { label: "Reward / User", value: `$${task.totalReward.toFixed(2)}` },
                    { label: "Total Slots", value: task.totalSlots.toLocaleString() },
                    { label: "Category", value: task.type.replace(/_/g, " ") },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl bg-zinc-900/60 px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{m.label}</p>
                      <p className="text-sm font-semibold text-white capitalize">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Reward tiers */}
                <div className="flex items-center gap-3 mb-4 text-xs flex-wrap">
                  <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">Free: <strong className="text-zinc-200">${task.freeUserReward.toFixed(2)}</strong></span>
                  <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">Verified: <strong className="text-zinc-200">${task.verifiedUserReward?.toFixed(2) ?? "—"}</strong></span>
                  <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">VIP: <strong className="text-zinc-200">${task.vipUserReward.toFixed(2)}</strong></span>
                </div>

                {/* Instructions */}
                <div className="rounded-xl bg-zinc-900/40 border border-white/[0.04] px-4 py-3 mb-4">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Instructions</p>
                  <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3">{task.instructions}</p>
                </div>

                {/* Proof requirements */}
                {task.proofRequirements && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <p className="w-full text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Proof Required</p>
                    {task.proofRequirements.screenshotRequired && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">Screenshot</span>
                    )}
                    {task.proofRequirements.usernameRequired && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-700/50 border border-zinc-600/30 text-zinc-400">Username</span>
                    )}
                    {task.proofRequirements.walletAddressRequired && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-700/50 border border-zinc-600/30 text-zinc-400">Wallet</span>
                    )}
                    {task.proofRequirements.emailRequired && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-700/50 border border-zinc-600/30 text-zinc-400">Email</span>
                    )}
                    {task.proofRequirements.customRequirement && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-700/50 border border-zinc-600/30 text-zinc-400">{task.proofRequirements.customRequirement}</span>
                    )}
                  </div>
                )}

                {/* Task link */}
                <div className="flex items-center gap-2 mb-5">
                  <a
                    href={task.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {task.link.length > 60 ? task.link.slice(0, 60) + "…" : task.link}
                  </a>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
                  <button
                    onClick={() => setConfirmAction({ taskId: task.id, action: "approve", task })}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 transition-all text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectNote("");
                      setConfirmAction({ taskId: task.id, action: "reject", task });
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-all text-sm font-medium"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <p className="ml-auto text-[10px] text-zinc-600 font-mono">{task.id.slice(-12)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmAction !== null}
        variant={confirmAction?.action === "approve" ? "success" : "danger"}
        title={confirmAction?.action === "approve" ? "Approve this task?" : "Reject this task?"}
        message={confirmAction?.action === "approve"
          ? `"${confirmAction?.task.title}" will go live in the marketplace immediately.`
          : `"${confirmAction?.task.title}" will be rejected. The advertiser's budget will remain locked until manually returned.`
        }
        confirmLabel={confirmAction?.action === "approve" ? "Approve Task" : "Reject Task"}
        noteLabel={confirmAction?.action === "reject" ? "Rejection reason (optional)" : undefined}
        noteValue={rejectNote}
        onNoteChange={setRejectNote}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmAction(null); setRejectNote(""); }}
      />
    </div>
  );
}
