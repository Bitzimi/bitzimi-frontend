import { useState, useEffect, useCallback } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  Play,
  Pause,
  Edit,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Loader2,
  Star,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useSettings } from "../contexts/SettingsContext";
import { toast } from "sonner";
import { EditTaskModal } from "../components/EditTaskModal";
import { getAmountTextSize } from "../utils/currencyHelpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

interface ManagedTask {
  id: string;
  title: string;
  type: string;
  link: string;
  instructions: string;
  // Accepts any variant — normalised by normStatus(): "pending_review" → "pending"
  status: "pending" | "pending_review" | "active" | "paused" | "completed" | "rejected";
  totalBudget: number;
  budgetUsed: number;
  budgetRemaining: number;
  rewardPerUser: number;
  totalSlots: number;
  completedSlots: number;
  remainingSlots: number;
  lockedBudget: number;
  createdAt: string;
}



interface FeaturedRequest {
  id: string;
  taskId: string;
  durationDays: number;
  amount: number;
  status: string;
  refundedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  promotion: {
    startsAt: string | null;
    endsAt: string | null;
    placements: { location: string }[];
  };
}

interface FeaturedPricingItem {
  durationDays: number;
  price: number;
  isActive: boolean;
}

const LOCATION_LABELS: Record<string, string> = {
  wallet: "Wallet",
  marketplace: "Tasks",
  referral: "Referrals",
  affiliate: "Affiliate",
  ambassador: "Ambassador",
};

/** Collapse all pending variants to canonical "pending" key */
function normStatus(raw: string): string {
  const s = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (s === "pending" || s === "pendingreview") return "pending";
  return s;
}

/** Human-readable badge label */
function statusLabel(raw: string): string {
  if (normStatus(raw) === "pending") return "Pending Review";
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[_-]/g, " ");
}

export default function TaskManager() {
  const { formatCurrency, currency } = useSettings();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "pending" | "completed">("all");
  const [editingTask, setEditingTask] = useState<ManagedTask | null>(null);

  // Featured placement state
  const [featuredRequests, setFeaturedRequests] = useState<FeaturedRequest[]>([]);
  const [featuredPricing, setFeaturedPricing] = useState<FeaturedPricingItem[]>([]);
  const [featureDialog, setFeatureDialog] = useState<{ task: ManagedTask } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["marketplace"]);
  const [submittingFeature, setSubmittingFeature] = useState(false);

  // Load advertiser's tasks from backend
  const loadTasks = useCallback(async () => {
    if (!API_BASE || !getToken()) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/mine`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      const items: any[] = json.data ?? [];
      setTasks(items.map(t => ({
        id:             t.id,
        title:          t.title,
        type:           t.type,
        link:           t.link ?? "",
        instructions:   t.description ?? "",
        status:         t.status as ManagedTask["status"],
        totalBudget:    t.totalBudget,
        budgetUsed:     t.completedSlots * t.rewardPerSlot,
        budgetRemaining: t.totalBudget - (t.completedSlots * t.rewardPerSlot),
        rewardPerUser:  t.rewardPerSlot,
        totalSlots:     t.totalSlots,
        completedSlots: t.completedSlots,
        remainingSlots: t.totalSlots - t.completedSlots,
        lockedBudget:   t.totalBudget - (t.completedSlots * t.rewardPerSlot),
        createdAt:      t.createdAt,
      })));
    } catch (e) {
      console.error("Error loading tasks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeaturedData = useCallback(async () => {
    if (!API_BASE || !getToken()) return;
    try {
      const [reqRes, priceRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/promotions/my-requests`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/v1/promotions/pricing`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (reqRes.ok) {
        const json = await reqRes.json();
        setFeaturedRequests(json.data ?? []);
      }
      if (priceRes.ok) {
        const json = await priceRes.json();
        setFeaturedPricing((json.data ?? []).filter((p: FeaturedPricingItem) => p.isActive));
      }
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => { loadTasks(); loadFeaturedData(); }, [loadTasks, loadFeaturedData]);

  const filteredTasks = filter === "all"
    ? tasks
    : tasks.filter(task => normStatus(task.status) === filter);

  // Calculate stats
  const totalBudgetAllocated = tasks.reduce((sum, t) => sum + t.totalBudget, 0);
  const totalBudgetUsed = tasks.reduce((sum, t) => sum + t.budgetUsed, 0);
  const totalLockedBudget = tasks.reduce((sum, t) => sum + t.lockedBudget, 0);
  const activeTasks = tasks.filter(t => normStatus(t.status) === "active").length;

  // Get dynamic text size based on currency
  const statAmountTextSize = getAmountTextSize(currency.rate, "2xl");

  const handleEditTask = (task: ManagedTask) => {
    setEditingTask(task);
  };

  const handleSaveTask = async (updatedTask: ManagedTask) => {
    if (!API_BASE || !getToken()) { toast.error("Backend connection required."); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${updatedTask.id}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ title: updatedTask.title, link: updatedTask.link }),
      });
      if (!res.ok) { toast.error("Failed to update task"); return; }
      await loadTasks(); // Refresh from backend
      toast.success("Task updated.");
    } catch { toast.error("Failed to update task."); }
  };

  const handlePauseTask = async (taskId: string) => {
    if (!API_BASE || !getToken()) { toast.error("Backend connection required."); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "paused" }),
      });
      if (!res.ok) { toast.error("Failed to pause task"); return; }
      await loadTasks();
      toast.success("Task paused.");
    } catch { toast.error("Failed to pause task."); }
  };

  const handleResumeTask = async (taskId: string) => {
    if (!API_BASE || !getToken()) { toast.error("Backend connection required."); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "active" }),
      });
      if (!res.ok) { const err = await res.json().catch(()=>({})); toast.error((err as any)?.error?.message ?? "Failed to resume task"); return; }
      await loadTasks();
      toast.success("Task resumed.");
    } catch { toast.error("Failed to resume task."); }
  };

  const getStatusColor = (raw: string): string => {
    switch (normStatus(raw)) {
      case "active":    return "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400";
      case "paused":    return "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400";
      case "pending":   return "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400";
      case "completed": return "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400";
      case "rejected":  return "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400";
      default:          return "bg-gray-500/10 border-gray-500/20 text-gray-600 dark:text-gray-400";
    }
  };

  const selectedPrice = featuredPricing.find(p => p.durationDays === selectedDuration)?.price ?? 0;

  const submitFeaturedRequest = async () => {
    if (!featureDialog || !API_BASE || !getToken()) return;
    if (selectedLocations.length === 0) { toast.error("Select at least one page"); return; }
    setSubmittingFeature(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/promotions/featured-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: featureDialog.task.id,
          durationDays: selectedDuration,
          locations: selectedLocations,
          title: featureDialog.task.title,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any)?.error?.message ?? "Failed to submit featured request");
        return;
      }
      toast.success("Featured request submitted! It will be reviewed by our team.");
      setFeatureDialog(null);
      loadFeaturedData();
    } catch {
      toast.error("Failed to submit featured request");
    } finally {
      setSubmittingFeature(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => navigate("/tasks")}
          variant="ghost"
          className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Task Manager</h1>
            <p className="text-sm text-gray-400">Manage your created tasks</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{tasks.length}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Tasks</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Play className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{activeTasks}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Active Tasks</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-purple-400" />
              </div>
            </div>
            <p className={`${statAmountTextSize} font-bold text-gray-900 dark:text-white mb-1`}>
              {formatCurrency(totalBudgetUsed)}
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Budget Used</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <p className={`${statAmountTextSize} font-bold text-gray-900 dark:text-white mb-1`}>
              {formatCurrency(totalLockedBudget)}
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Locked Budget</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters — live counts, normalised to handle all status variants */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["all", "active", "pending", "paused", "completed"] as const).map((tab) => {
          const LABELS: Record<string, string> = {all:"All",active:"Active",pending:"Pending",paused:"Paused",completed:"Completed"};
          const count = tab === "all" ? tasks.length : tasks.filter(t => normStatus(t.status) === tab).length;
          return (
            <Button key={tab} onClick={() => setFilter(tab)}
              variant={filter === tab ? "default" : "outline"} size="sm"
              className={`shrink-0 ${filter===tab
                ?"bg-blue-600 hover:bg-blue-700 text-white"
                :"border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"}`}>
              {LABELS[tab]}
              {count > 0 && <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter===tab?"bg-white/20":"bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400"}`}>{count}</span>}
            </Button>
          );
        })}
      </div>

      {/* Task Table - Desktop */}
      <div className="hidden lg:block">
        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-300 dark:border-slate-700/50 bg-gray-200 dark:bg-slate-900/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Completions
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredTasks.map((task) => {
                    const budgetProgress = (task.budgetUsed / task.totalBudget) * 100;
                    const completionProgress = (task.completedSlots / task.totalSlots) * 100;

                    return (
                      <tr key={task.id} className="hover:bg-gray-200 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{task.title}</p>
                            <p className="text-xs text-gray-500">
                              Reward: {formatCurrency(task.rewardPerUser)}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={getStatusColor(task.status)}>
                            {statusLabel(task.status)}
                          </Badge>
                          {task.lockedBudget > 0 && (
                            <p className="text-xs text-amber-400 mt-1">
                              🔒 {formatCurrency(task.lockedBudget)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                              {formatCurrency(task.budgetUsed)} / {formatCurrency(task.totalBudget)}
                            </p>
                            <div className="w-full bg-slate-700/30 rounded-full h-1.5 mb-1">
                              <div
                                className="bg-purple-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${budgetProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(task.budgetRemaining)} remaining
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                              {task.completedSlots.toLocaleString()} /{" "}
                              {task.totalSlots.toLocaleString()}
                            </p>
                            <div className="w-full bg-slate-700/30 rounded-full h-1.5 mb-1">
                              <div
                                className="bg-green-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${completionProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">
                              {task.remainingSlots.toLocaleString()} slots left
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {task.status === "active" && (
                              <Button
                                onClick={() => handlePauseTask(task.id)}
                                size="sm"
                                variant="outline"
                                className="border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                              >
                                <Pause className="h-3 w-3 mr-1" />
                                Pause
                              </Button>
                            )}
                            {task.status === "paused" && (
                              <Button
                                onClick={() => handleResumeTask(task.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Resume
                              </Button>
                            )}
                            {(task.status === "active" || task.status === "paused") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-gray-300"
                                onClick={() => handleEditTask(task)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTasks.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-gray-400">No tasks found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Cards - Mobile */}
      <div className="lg:hidden space-y-4">
        {filteredTasks.map((task) => {
          const budgetProgress = (task.budgetUsed / task.totalBudget) * 100;
          const completionProgress = (task.completedSlots / task.totalSlots) * 100;

          return (
            <Card key={task.id} className="bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{task.title}</h3>
                    <p className="text-xs text-gray-400">
                      Reward: {formatCurrency(task.rewardPerUser)}
                    </p>
                  </div>
                  <Badge className={getStatusColor(task.status)}>
                    {statusLabel(task.status)}
                  </Badge>
                </div>

                {task.lockedBudget > 0 && (
                  <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-900 dark:text-amber-400 font-semibold">
                    🔒 Locked: {formatCurrency(task.lockedBudget)}
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Budget</span>
                      <span className="text-gray-900 dark:text-gray-300 font-semibold">
                        {formatCurrency(task.budgetUsed)} / {formatCurrency(task.totalBudget)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700/30 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${budgetProgress}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Completions</span>
                      <span className="text-gray-900 dark:text-gray-300 font-semibold">
                        {task.completedSlots} / {task.totalSlots}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700/30 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${completionProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {task.status === "active" && !featuredRequests.some(fr => fr.taskId === task.id) && (
                    <Button
                      onClick={() => { setFeatureDialog({ task }); setSelectedDuration(featuredPricing[0]?.durationDays ?? 1); setSelectedLocations(["marketplace"]); }}
                      size="sm"
                      variant="outline"
                      className="border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Feature
                    </Button>
                  )}
                  {task.status === "active" && (
                    <Button
                      onClick={() => handlePauseTask(task.id)}
                      size="sm"
                      variant="outline"
                      className="flex-1 border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {task.status === "paused" && (
                    <Button
                      onClick={() => handleResumeTask(task.id)}
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                  )}
                  {(task.status === "active" || task.status === "paused") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-gray-300"
                      onClick={() => handleEditTask(task)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredTasks.length === 0 && (
          <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
            <CardContent className="py-16 text-center">
              <p className="text-gray-400">No tasks found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Featured Placement Section ─────────────────────────────────────── */}
      {(featuredRequests.length > 0 || tasks.some(t => normStatus(t.status) === "active")) && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Featured Placement</h2>
          </div>

          {/* Active tasks that can be featured */}
          {tasks.filter(t => normStatus(t.status) === "active" && !featuredRequests.some(fr => fr.taskId === t.id)).map(task => (
            <Card key={task.id} className="mb-3 bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{task.title}</p>
                  <p className="text-xs text-gray-400">Boost visibility across the platform</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setFeatureDialog({ task });
                    setSelectedDuration(featuredPricing[0]?.durationDays ?? 1);
                    setSelectedLocations(["marketplace"]);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Feature
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Existing featured requests */}
          {featuredRequests.map(fr => {
            const task = tasks.find(t => t.id === fr.taskId);
            const statusColors: Record<string, string> = {
              pending_marketplace: "text-amber-400 bg-amber-500/10 border-amber-500/20",
              pending_featured:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
              approved:            "text-green-400 bg-green-500/10 border-green-500/20",
              active:              "text-green-400 bg-green-500/10 border-green-500/20",
              expired:             "text-gray-400 bg-gray-500/10 border-gray-500/20",
              rejected:            "text-red-400 bg-red-500/10 border-red-500/20",
              refunded:            "text-orange-400 bg-orange-500/10 border-orange-500/20",
            };
            const colorClass = statusColors[fr.status] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20";
            const pages = fr.promotion?.placements?.map(p => LOCATION_LABELS[p.location] ?? p.location).join(", ") ?? "—";
            return (
              <Card key={fr.id} className="mb-3 bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Star className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {task?.title ?? "Task"}
                        </p>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${colorClass}`}>
                          {fr.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <p className="text-xs text-gray-400">Duration: <span className="text-gray-700 dark:text-gray-300">{fr.durationDays} day{fr.durationDays !== 1 ? "s" : ""}</span></p>
                        <p className="text-xs text-gray-400">Pages: <span className="text-gray-700 dark:text-gray-300">{pages}</span></p>
                        <p className="text-xs text-gray-400">Payment: <span className="text-gray-700 dark:text-gray-300">${fr.amount.toFixed(2)}</span></p>
                        {fr.promotion?.endsAt && (
                          <p className="text-xs text-gray-400">Expires: <span className="text-gray-700 dark:text-gray-300">{new Date(fr.promotion.endsAt).toLocaleDateString()}</span></p>
                        )}
                      </div>
                      {fr.rejectionReason && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span>{fr.rejectionReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          open={!!editingTask}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Feature This Task Dialog */}
      <Dialog open={!!featureDialog} onOpenChange={() => setFeatureDialog(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#18181b] border-gray-200 dark:border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-400" />
              Feature This Task
            </DialogTitle>
          </DialogHeader>
          {featureDialog && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Promote <span className="font-semibold text-gray-900 dark:text-white">"{featureDialog.task.title}"</span> across the platform.
                Payment is deducted from your main wallet immediately.
              </p>

              {/* Duration selector */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Duration</p>
                <div className="grid grid-cols-4 gap-2">
                  {featuredPricing.map(p => (
                    <button
                      key={p.durationDays}
                      onClick={() => setSelectedDuration(p.durationDays)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        selectedDuration === p.durationDays
                          ? "border-purple-500/60 bg-purple-500/10 text-purple-400"
                          : "border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 hover:border-purple-500/30"
                      }`}
                    >
                      <p className="text-xs font-bold">{p.durationDays}d</p>
                      <p className="text-[10px] mt-0.5">${p.price}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location selector */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Show on pages</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(LOCATION_LABELS).map(([loc, label]) => {
                    const checked = selectedLocations.includes(loc);
                    return (
                      <button
                        key={loc}
                        onClick={() => setSelectedLocations(prev =>
                          checked ? prev.filter(l => l !== loc) : [...prev, loc]
                        )}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                          checked
                            ? "border-purple-500/60 bg-purple-500/10 text-purple-400"
                            : "border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 hover:border-purple-500/30"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? "bg-purple-500 border-purple-500" : "border-gray-400 dark:border-gray-600"
                        }`}>
                          {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-xl bg-purple-500/8 border border-purple-500/20">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total cost</span>
                  <span className="font-bold text-purple-400">${selectedPrice.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Deducted from your main wallet immediately upon submission</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-300 dark:border-white/[0.08]"
                  onClick={() => setFeatureDialog(null)}
                  disabled={submittingFeature}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={submitFeaturedRequest}
                  disabled={submittingFeature || selectedLocations.length === 0 || selectedPrice === 0}
                >
                  {submittingFeature
                    ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Submitting…</>
                    : <><Star className="h-4 w-4 mr-2" />Submit Request</>
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}