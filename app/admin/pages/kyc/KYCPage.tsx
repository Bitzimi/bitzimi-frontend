import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck, Clock, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { adminKycService, type AdminKycSubmission } from "../../services/adminDataService";

type StatusFilter = "" | "pending" | "under_review";

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "All Pending",   value: "" },
  { label: "Pending",       value: "pending" },
  { label: "Under Review",  value: "under_review" },
];

export default function KYCPage() {
  const navigate = useNavigate();

  const [items, setItems]     = useState<AdminKycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<StatusFilter>("");

  const load = async (status: StatusFilter) => {
    setLoading(true);
    try {
      const data = await adminKycService.fetchQueue(status || undefined);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const counts = {
    pending:      items.filter(i => i.status === "pending").length,
    under_review: items.filter(i => i.status === "under_review").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="KYC Review"
        description="Identity verification queue. Review submitted documents, approve or reject."
        actions={
          <button
            onClick={() => load(filter)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs text-zinc-500">Pending Submission</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">{counts.pending}</p>
        </div>
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-indigo-400" />
            <p className="text-xs text-zinc-500">Under Review</p>
          </div>
          <p className="text-2xl font-bold text-indigo-400">{counts.under_review}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 border-b border-white/[0.05] pb-4">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.value
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No submissions"
            description="There are no KYC submissions in this queue."
          />
        ) : (
          <div className="space-y-0 divide-y divide-white/[0.04]">
            {items.map(sub => (
              <div
                key={sub.id}
                onClick={() => navigate(`/admin/kyc/${sub.id}`)}
                className="flex items-center gap-4 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors group rounded-xl px-2 -mx-2"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-amber-400">
                    {(sub.user.username || sub.user.email || "?").charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-medium text-white">{sub.user.username || sub.user.email}</p>
                    <StatusBadge status={sub.status === "under_review" ? "review" : "pending"} />
                  </div>
                  <div className="flex gap-4 mt-0.5 text-[11px] text-zinc-500">
                    <span>{sub.user.email}</span>
                    {sub.idType && <span>{sub.idType.replace(/_/g, " ")}</span>}
                    {sub.countryCode && <span>{sub.countryCode}</span>}
                    {sub.submittedAt && <span>Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* KYC full name */}
                {sub.fullName && (
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-zinc-300">{sub.fullName}</p>
                    <p className="text-[10px] text-zinc-600">Legal name</p>
                  </div>
                )}

                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
