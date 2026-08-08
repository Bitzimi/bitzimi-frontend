import { useState, useEffect } from "react";
import { FileCheck, CheckCircle2, XCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { adminProofService } from "../../services/adminDataService";
import type { AdminReviewItem } from "../../services/adminDataService";

export default function ProofReviewPage() {
  const [queue, setQueue] = useState<AdminReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [confirmAction, setConfirmAction] = useState<{
    item: AdminReviewItem; decision: "approved" | "rejected";
  } | null>(null);
  const [note, setNote] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const load = async () => {
    setLoading(true);
    const items = filter === "pending"
      ? await adminProofService.getReviewQueue()
      : await adminProofService.getAllReviewItems();
    setQueue(items);
    const pending = await adminProofService.getReviewQueue();
    setPendingCount(pending.length);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDecide = async () => {
    if (!confirmAction) return;
    await adminProofService.decide(confirmAction.item.reviewId, confirmAction.decision, note || undefined);
    setConfirmAction(null);
    setNote("");
    load();
  };

  const confidenceColor = (n: number) =>
    n >= 85 ? "text-emerald-400" : n >= 70 ? "text-amber-400" : "text-red-400";

  const confidenceBg = (n: number) =>
    n >= 85 ? "bg-emerald-500/10 border-emerald-500/20" : n >= 70 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

  const rewardAmount = (item: AdminReviewItem): number =>
    typeof item.proof?.rewardAmount === "number" ? item.proof.rewardAmount : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Proof Review Queue"
        description="Task proof submissions flagged by AI (70–84% confidence) requiring manual review."
        badge={pendingCount > 0 ? { label: `${pendingCount} pending`, variant: "warning" } : undefined}
        actions={
          <div className="flex gap-2">
            {(["pending", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? "bg-indigo-600 text-white"
                    : "border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                }`}
              >
                {f === "pending" ? "Pending" : "All history"}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-zinc-800/30 animate-pulse" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FileCheck}
            title={filter === "pending" ? "Review queue is empty" : "No proof submissions found"}
            description={filter === "pending" ? "All proof submissions have been reviewed." : undefined}
          />
        </SectionCard>
      ) : (
        <div className="space-y-5">
          {queue.map(item => (
            <div key={item.reviewId} className="rounded-2xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.05]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.task.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    by <span className="text-zinc-400">{item.username}</span>
                    {" · "}
                    {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${confidenceBg(item.aiConfidence)} ${confidenceColor(item.aiConfidence)}`}>
                    <TrendingUp className="w-3 h-3" />
                    {item.aiConfidence}% confidence
                  </div>
                  {item.decision && (
                    <StatusBadge status={item.decision === "approved" ? "approved" : "rejected"} />
                  )}
                </div>
              </div>

              {/* Screenshots grid */}
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* User proofs */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                    User Proof{item.proofScreenshotUrls.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-2">
                    {item.proofScreenshotUrls.filter(Boolean).map((url, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
                        <img src={url} alt={`Proof ${i + 1}`} className="w-full max-h-52 object-cover" />
                        <p className="text-[10px] text-zinc-600 px-2 py-1">Screenshot {i + 1}</p>
                      </div>
                    ))}
                    {item.proofScreenshotUrls.length === 0 && (
                      <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center">
                        <p className="text-xs text-zinc-600">No screenshots uploaded</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advertiser references */}
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                    Advertiser References ({item.task.referenceScreenshotUrls?.length ?? 0})
                  </p>
                  {item.task.referenceScreenshotUrls?.length ? (
                    <div className="space-y-2">
                      {item.task.referenceScreenshotUrls.map((url, i) => (
                        <div key={i} className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
                          <img src={url} alt={`Reference ${i + 1}`} className="w-full max-h-52 object-cover" />
                          <p className="text-[10px] text-zinc-600 px-2 py-1">Reference {i + 1}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center">
                      <p className="text-xs text-zinc-600">No reference screenshots uploaded by advertiser</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI analysis */}
              <div className="mx-5 mb-5 rounded-xl bg-zinc-900/50 border border-white/[0.04] px-4 py-3">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  AI Analysis
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">{item.aiAnalysis}</p>
              </div>

              {/* Task instructions */}
              {item.task.proofInstructions && (
                <div className="mx-5 mb-5 rounded-xl bg-zinc-900/30 border border-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Task Instructions</p>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{item.task.proofInstructions}</p>
                </div>
              )}

              {/* Actions */}
              {!item.decision ? (
                <div className="flex items-center gap-3 px-5 pb-5">
                  <button
                    onClick={() => { setNote(""); setConfirmAction({ item, decision: "approved" }); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 transition-all text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Proof
                  </button>
                  <button
                    onClick={() => { setNote(""); setConfirmAction({ item, decision: "rejected" }); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-all text-sm font-medium"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Proof
                  </button>
                  <p className="ml-auto text-xs text-zinc-500 font-medium">
                    Reward held: <span className="text-zinc-300">${rewardAmount(item).toFixed(2)}</span>
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-5 pb-5">
                  <StatusBadge status={item.decision === "approved" ? "approved" : "rejected"} size="md" />
                  {item.decisionNote && (
                    <p className="text-xs text-zinc-500 italic">"{item.decisionNote}"</p>
                  )}
                  {item.reviewedAt && (
                    <p className="ml-auto text-xs text-zinc-600">
                      {new Date(item.reviewedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        variant={confirmAction?.decision === "approved" ? "success" : "danger"}
        title={confirmAction?.decision === "approved" ? "Approve this proof?" : "Reject this proof?"}
        message={confirmAction?.decision === "approved"
          ? `The reward of $${rewardAmount(confirmAction!.item).toFixed(2)} will be credited to ${confirmAction?.item.username}.`
          : `The reward of $${rewardAmount(confirmAction!.item).toFixed(2)} will remain held. The user will be notified.`
        }
        confirmLabel={confirmAction?.decision === "approved" ? "Approve & Credit Reward" : "Reject Proof"}
        noteLabel="Note to user (optional)"
        noteValue={note}
        onNoteChange={setNote}
        onConfirm={handleDecide}
        onCancel={() => { setConfirmAction(null); setNote(""); }}
      />
    </div>
  );
}
