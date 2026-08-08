import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Store, ExternalLink } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { adminTaskService } from "../../services/adminDataService";
import { CategoryIcon } from "../../../pages/Tasks";
import type { Task } from "../../../pages/Tasks";

type StatusFilter = "all" | "active" | "pending_review" | "paused" | "completed" | "rejected";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "active",       label: "Active" },
  { value: "pending_review",label: "Pending" },
  { value: "paused",       label: "Paused" },
  { value: "completed",    label: "Completed" },
  { value: "rejected",     label: "Rejected" },
];

export default function TasksMarketplacePage() {
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAllTasks(await adminTaskService.getAllTasks());
      setLoading(false);
    })();
  }, []);

  const filtered = statusFilter === "all"
    ? allTasks
    : allTasks.filter(t =>
        t.status === statusFilter ||
        (statusFilter === "pending_review" && (t.status as string) === "pending-review")
      );

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === "all"
      ? allTasks.length
      : allTasks.filter(t =>
          t.status === f.value ||
          (f.value === "pending_review" && (t.status as string) === "pending-review")
        ).length;
    return acc;
  }, {} as Record<StatusFilter, number>);

  const columns: Column<Task>[] = [
    {
      key: "title",
      header: "Task",
      render: t => (
        <div className="flex items-center gap-3 min-w-0">
          {t.campaignImageUrl ? (
            <img src={t.campaignImageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <CategoryIcon categoryId={t.type} size={16} />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate max-w-[200px]">{t.title}</p>
            <p className="text-[11px] text-zinc-500">{t.advertiserName}</p>
          </div>
        </div>
      ),
      sortable: true, sortValue: t => t.title,
    },
    {
      key: "status",
      header: "Status",
      render: t => <StatusBadge status={t.status} />,
      sortable: true, sortValue: t => t.status,
      hideOnMobile: false,
    },
    {
      key: "budget",
      header: "Budget",
      align: "right",
      render: t => (
        <div className="text-right">
          <p className="text-sm font-semibold text-white tabular-nums">${t.totalBudget.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500">{t.totalSlots} slots</p>
        </div>
      ),
      sortable: true, sortValue: t => t.totalBudget,
      hideOnMobile: true,
    },
    {
      key: "progress",
      header: "Progress",
      render: t => {
        const pct = t.totalSlots > 0 ? (t.completedSlots / t.totalSlots) * 100 : 0;
        return (
          <div className="min-w-[80px]">
            <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
              <span>{t.completedSlots}/{t.totalSlots}</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800">
              <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
      hideOnMobile: true,
    },
    {
      key: "reward",
      header: "Reward",
      align: "right",
      render: t => (
        <p className="text-sm text-zinc-300 tabular-nums">${t.totalReward.toFixed(2)}</p>
      ),
      sortable: true, sortValue: t => t.totalReward,
      hideOnMobile: true,
    },
    {
      key: "created",
      header: "Created",
      render: t => (
        <p className="text-xs text-zinc-500 whitespace-nowrap">
          {new Date(t.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </p>
      ),
      sortable: true, sortValue: t => t.createdAt,
      hideOnMobile: true,
    },
    {
      key: "link",
      header: "",
      align: "right",
      render: t => (
        <a
          href={t.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Task Marketplace"
        description="All task campaigns across the platform."
      />

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              statusFilter === f.value
                ? "bg-indigo-600 text-white"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {f.label}
            {counts[f.value] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                statusFilter === f.value ? "bg-white/20" : "bg-zinc-700 text-zinc-400"
              }`}>
                {counts[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={t => t.id}
          onRowClick={t => navigate(`/admin/tasks/${t.id}`)}
          loading={loading}
          emptyIcon={Store}
          emptyTitle={statusFilter === "all" ? "No tasks found" : `No ${statusFilter.replace("_", " ")} tasks`}
          emptyDescription="Tasks created on this platform will appear here."
          searchPlaceholder="Search tasks…"
          searchKeys={["title", "advertiserName", t => t.type]}
          pageSize={15}
        />
      </div>
    </div>
  );
}
