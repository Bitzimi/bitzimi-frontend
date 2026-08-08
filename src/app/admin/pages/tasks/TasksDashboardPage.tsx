import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ClipboardCheck, Store, FileCheck, CheckCircle2, DollarSign,
  ArrowRight, Bot, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { adminStatsService, type AdminStats } from "../../services/adminDataService";

export default function TasksDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminStatsService.fetchSummary().then(s => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  const kpis = [
    {
      title: "Pending Approval",
      value: stats?.pendingTasks ?? 0,
      icon: ClipboardCheck,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      path: "/admin/tasks/pending",
    },
    {
      title: "Active Tasks",
      value: stats?.activeTasks ?? 0,
      icon: Store,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      path: "/admin/tasks/marketplace",
    },
    {
      title: "Completed Tasks",
      value: stats?.completedTasks ?? 0,
      icon: CheckCircle2,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10",
      path: "/admin/tasks/marketplace",
    },
    {
      title: "Proof Queue",
      value: stats?.proofReviewQueue ?? 0,
      icon: FileCheck,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
      path: "/admin/tasks/proofs",
    },
    {
      title: "Proofs Approved",
      value: stats?.totalProofsApproved ?? 0,
      icon: CheckCircle2,
      iconColor: "text-teal-400",
      iconBg: "bg-teal-500/10",
      path: "/admin/tasks/proofs",
    },
    {
      title: "Rewards Paid",
      value: `$${(stats?.taskRewardsPaidUSD ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      iconColor: "text-green-400",
      iconBg: "bg-green-500/10",
      path: "/admin/tasks/marketplace",
    },
  ];

  const quickNav = [
    {
      title: "Pending Approval",
      description: "Review and approve or reject new task submissions from advertisers.",
      icon: ClipboardCheck,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/15",
      badge: stats?.pendingTasks ?? 0,
      path: "/admin/tasks/pending",
    },
    {
      title: "All Tasks",
      description: "Browse every task campaign — active, completed, paused, and rejected.",
      icon: Store,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/15",
      badge: null,
      path: "/admin/tasks/marketplace",
    },
    {
      title: "Proof Review Queue",
      description: "Manual review of AI-flagged proof submissions (70–84% confidence).",
      icon: FileCheck,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/15",
      badge: stats?.proofReviewQueue ?? 0,
      path: "/admin/tasks/proofs",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Task Management"
        description="Overview of the task marketplace — approvals, proof reviews, and budget activity."
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(kpi => (
          <StatCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            iconColor={kpi.iconColor}
            iconBg={kpi.iconBg}
            loading={loading}
            onClick={() => navigate(kpi.path)}
          />
        ))}
      </div>

      {/* Quick navigation cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickNav.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                onClick={() => navigate(item.path)}
                className="text-left rounded-2xl bg-[#18181b] border border-white/[0.06] p-5 hover:border-white/[0.10] hover:bg-[#1c1c22] transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center`}>
                    <Icon className={`w-4.5 h-4.5 ${item.color}`} />
                  </div>
                  {item.badge !== null && item.badge > 0 && (
                    <span className="flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-bold">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">{item.description}</p>
                <div className="flex items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Verification Tier Panel */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">AI Verification Tiers</h2>
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Claude Vision Verification</p>
              <p className="text-xs text-zinc-500">Server-side AI analysis for every proof submission</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Auto-Approve</span>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums mb-1">≥ 85%</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Proof automatically approved. Reward credited to worker's task wallet instantly.
              </p>
            </div>

            <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Manual Review</span>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums mb-1">70 – 84%</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Borderline confidence. Queued for admin decision. Admin approves or rejects with optional note.
              </p>
            </div>

            <div className="rounded-xl bg-red-500/[0.06] border border-red-500/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Auto-Reject</span>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums mb-1">&lt; 70%</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Proof automatically rejected. Worker notified. Reward remains held in task vault.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
