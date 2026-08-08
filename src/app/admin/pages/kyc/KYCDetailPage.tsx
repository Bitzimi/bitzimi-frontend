import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, ShieldCheck, ExternalLink, CheckCircle2, XCircle, AlertTriangle, User,
} from "lucide-react";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { adminKycService, type AdminKycSubmissionDetail } from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

export default function KYCDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate          = useNavigate();
  const { can }           = useAdminAccess();

  const [detail, setDetail]   = useState<AdminKycSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [dialog, setDialog]   = useState<"approve" | "reject" | null>(null);
  const [reason, setReason]   = useState("");
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    setLoading(true);
    adminKycService.fetchDetail(submissionId)
      .then(data => {
        if (!data) throw new Error("Submission not found");
        setDetail(data);
      })
      .catch(e => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleApprove = async () => {
    if (!submissionId) return;
    setBusy(true);
    try {
      await adminKycService.approve(submissionId);
      navigate("/admin/kyc");
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const handleReject = async () => {
    if (!submissionId || !reason.trim()) return;
    setBusy(true);
    try {
      await adminKycService.reject(submissionId, reason.trim());
      navigate("/admin/kyc");
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-10 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Submission not found</p>
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  const alreadyDecided = detail.status === "verified" || detail.status === "rejected";

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => navigate("/admin/kyc")} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> KYC Queue
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-lg font-bold text-white">{detail.user.username || detail.user.email}</h2>
              <StatusBadge status={detail.status === "under_review" ? "review" : detail.status as any} size="md" />
            </div>
            <p className="text-sm text-zinc-400">{detail.user.email}</p>
            {detail.submittedAt && (
              <p className="text-xs text-zinc-500 mt-1">Submitted {new Date(detail.submittedAt).toLocaleString()}</p>
            )}
          </div>

          {/* Action buttons — only show if pending/under_review */}
          {!alreadyDecided && (
            <div className="flex gap-2 flex-shrink-0">
              {can("admin.kyc.reject") && (
                <button
                  onClick={() => setDialog("reject")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-sm text-red-300 hover:bg-red-600/30 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              )}
              {can("admin.kyc.approve") && (
                <button
                  onClick={() => setDialog("approve")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-sm text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              )}
            </div>
          )}

          {/* Already decided banner */}
          {alreadyDecided && (
            <div className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              detail.status === "verified"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              {detail.status === "verified" ? "Approved" : "Rejected"}
              {detail.reviewedAt && <span className="ml-1 opacity-70">{new Date(detail.reviewedAt).toLocaleDateString()}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Personal Information */}
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Personal Information</h3>
          </div>
          <dl className="space-y-3">
            {detail.fullName      && <KYCRow label="Full Name"      value={detail.fullName} />}
            {detail.dateOfBirth   && <KYCRow label="Date of Birth"  value={detail.dateOfBirth} />}
            {detail.countryCode   && <KYCRow label="Country"        value={detail.countryCode} />}
            {detail.idType        && <KYCRow label="ID Type"        value={detail.idType.replace(/_/g, " ")} />}
            {detail.address       && <KYCRow label="Address"        value={detail.address} />}
            {detail.rejectionReason && <KYCRow label="Rejection Reason" value={detail.rejectionReason} accent="red" />}
          </dl>
        </div>

        {/* Document Images */}
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Documents</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "ID Front",        url: detail.documentUrls.front },
              { label: "ID Back",         url: detail.documentUrls.back },
              { label: "Selfie",          url: detail.documentUrls.selfie },
              { label: "Proof of Address",url: detail.documentUrls.poa },
            ] as const).map(doc => (
              <div key={doc.label} className="rounded-xl bg-zinc-900 border border-white/[0.05] overflow-hidden">
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="block relative group">
                    <img
                      src={doc.url}
                      alt={doc.label}
                      className="w-full h-24 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <ExternalLink className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-[10px] text-zinc-500 px-2 py-1">{doc.label}</p>
                  </a>
                ) : (
                  <div className="h-24 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-zinc-600">{doc.label}</p>
                    <p className="text-[10px] text-zinc-700">Not submitted</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-3">Click any document to open in a new tab. Links expire after 1 hour.</p>
        </div>
      </div>

      {/* Navigate to full user */}
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4 flex items-center justify-between">
        <p className="text-sm text-zinc-400">View full user profile and account history.</p>
        <button
          onClick={() => navigate(`/admin/users/${detail.user.id}`)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Open User Profile →
        </button>
      </div>

      {/* Approve dialog */}
      <ConfirmDialog
        open={dialog === "approve"}
        variant="success"
        title="Approve KYC Submission"
        message={`Approve identity verification for ${detail.user.username || detail.user.email}. Their account will be upgraded to Verified status and they will be notified.`}
        confirmLabel={busy ? "Approving…" : "Approve"}
        onConfirm={handleApprove}
        onCancel={() => setDialog(null)}
      />

      {/* Reject dialog */}
      {dialog === "reject" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Reject KYC Submission</h3>
                <p className="text-sm text-zinc-400">Provide a reason. The user will receive this message and can resubmit.</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Document image is blurry, ID is expired, selfie does not match…"
                className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDialog(null)} className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-sm font-medium transition-all">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={busy || !reason.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {busy ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KYCRow({ label, value, accent }: { label: string; value: string; accent?: "red" }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-xs text-zinc-500 flex-shrink-0">{label}</dt>
      <dd className={`text-xs text-right ${accent === "red" ? "text-red-400" : "text-zinc-300"}`}>{value}</dd>
    </div>
  );
}
