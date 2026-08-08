import { useState, useEffect } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  Search,
  Filter,
  TrendingUp,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  BarChart3,
  UnlockKeyhole,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useSettings } from "../contexts/SettingsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { FeaturedPromotionCard } from "../components/FeaturedPromotionCard";
import { useVerification } from "../contexts/VerificationContext";
import { useIdentity } from "../contexts/IdentityContext";
import { liveActivityService } from "../services/liveActivityService";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { TaskModal } from "../components/TaskModal";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { TASK_CATEGORIES, getCategoryById } from "../constants/taskCategories";

const TASKS_API = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

export const TASK_TYPES = TASK_CATEGORIES.map(cat => ({
  value: cat.id,
  label: cat.label,
  icon: cat.id, // use category ID for icon lookup instead of emoji
}));

/** Render a task category icon inline (SVG brand logo) */
export function CategoryIcon({ categoryId, size = 20 }: { categoryId: string; size?: number }) {
  const cat = getCategoryById(categoryId);
  if (!cat) return <span className="text-gray-400">•</span>;
  return (
    <div className={`rounded-lg flex items-center justify-center ${cat.iconBg}`} style={{ width: size + 8, height: size + 8 }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill={cat.iconColor}>
        <g dangerouslySetInnerHTML={{ __html: cat.svgIcon }} />
      </svg>
    </div>
  );
}

export interface Task {
  id: string;
  title: string;
  type: string;
  link: string;
  instructions: string;
  additionalInstructions?: string;
  totalReward: number;
  freeUserReward: number;    // 35%
  verifiedUserReward: number; // 45%
  vipUserReward: number;     // 65%
  totalBudget: number;
  totalSlots: number;
  completedSlots: number;
  remainingSlots: number;
  // Status includes pending_review for tasks awaiting admin approval
  status: "active" | "paused" | "completed" | "pending_review";
  createdAt: string;
  advertiserId: string;
  advertiserName: string;
  campaignImageUrl?: string; // Optional campaign image
  proofRequirements?: {
    screenshotRequired: boolean;
    usernameRequired: boolean;
    walletAddressRequired: boolean;
    linkRequired: boolean;
    emailRequired: boolean;
    customRequirement?: string;
  };
}


export default function Tasks() {
  const { formatCurrency, t } = useSettings();
  const { addNotification } = useNotifications();
  const { isVerified } = useVerification();
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [isVIP, setIsVIP] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [customTasks, setCustomTasks] = useState<Task[]>([]);

  // Helper function to get user reward based on tier
  const getUserReward = (task: Task): number => {
    if (isVIP) return task.vipUserReward;
    if (isVerified) return task.verifiedUserReward;
    return task.freeUserReward;
  };

  // Helper function to get user tier label
  const getUserTierLabel = (): string => {
    if (isVIP) return "VIP 65%";
    if (isVerified) return "Verified 45%";
    return "Free 35%";
  };

  // User-specific completed task storage key
  const completedKey = `completedTasks_${identity.userId}`;

  // Load marketplace tasks from backend API
  const loadCustomTasks = async () => {
    if (TASKS_API && getToken()) {
      try {
        const res = await fetch(`${TASKS_API}/api/v1/tasks?limit=50`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const json = await res.json();
          const items = json.data?.items ?? [];
          // Map backend task shape to frontend Task interface
          setCustomTasks(items.map((t: any) => ({
            id:                  t.id,
            title:               t.title,
            type:                t.type,
            link:                t.link ?? "",
            instructions:        t.description ?? "",
            totalReward:         t.rewardPerSlot,
            freeUserReward:      +(t.rewardPerSlot * 0.35).toFixed(4),
            verifiedUserReward:  +(t.rewardPerSlot * 0.45).toFixed(4),
            vipUserReward:       +(t.rewardPerSlot * 0.65).toFixed(4),
            totalBudget:         t.totalBudget,
            totalSlots:          t.totalSlots,
            completedSlots:      t.completedSlots,
            remainingSlots:      t.totalSlots - t.completedSlots,
            status:              t.status,
            createdAt:           t.createdAt,
            advertiserId:        t.advertiserId,
            advertiserName:      t.advertiserName,
            campaignImageUrl:    t.campaignImageUrl ?? undefined,
            proofRequirements:   t.requirements?.length > 0
              ? { screenshotRequired: true, usernameRequired: false, walletAddressRequired: false, linkRequired: false, emailRequired: false }
              : undefined,
          })));
          return;
        }
      } catch (e) {
        console.error("Error loading marketplace tasks from backend:", e);
      }
    }
    // Backend unavailable — show empty marketplace (no offline simulation)
    setCustomTasks([]);
  };

  useEffect(() => {
    // Load VIP status from backend
    if (TASKS_API && getToken()) {
      fetch(`${TASKS_API}/api/v1/vip`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.ok ? r.json() : null)
        .then(json => { if (json?.data?.isActive) setIsVIP(true); })
        .catch(() => {});
    }
    // User-specific completed task IDs
    try {
      const completed = localStorage.getItem(completedKey);
      if (completed) setCompletedTaskIds(JSON.parse(completed));
    } catch {}
    loadCustomTasks();
  }, [identity.userId]);

  const allTasks = [...customTasks];

  // Marketplace-visible tasks: active, has remaining slots, not completed by THIS user
  const availableTasks = allTasks.filter(
    t => t.status === "active" && t.remainingSlots > 0 && !completedTaskIds.includes(t.id)
  );

  // Marketplace search only — status filters live in Task Manager (creator dashboard)
  const filteredTasks = availableTasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTaskTypeInfo = (type: string) => {
    return TASK_TYPES.find((t) => t.value === type) || TASK_TYPES[TASK_TYPES.length - 1];
  };

  const handleStartTask = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCompleteTask = (taskId: string, reward: number) => {
    const task = allTasks.find(t => t.id === taskId);

    // Mark task as completed locally (prevents re-submission by this user)
    const newCompleted = [...completedTaskIds, taskId];
    setCompletedTaskIds(newCompleted);
    localStorage.setItem(completedKey, JSON.stringify(newCompleted));

    // Reload marketplace from backend so slot counts reflect the backend's settled state
    loadCustomTasks();

    // Add notification — wallet already credited by backend, no local wallet mutation
    addNotification(
      "task_completed",
      "✅ Task Completed!",
      `You earned ${formatCurrency(reward)} for completing "${task?.title || "task"}"`,
      { taskId, reward, taskTitle: task?.title }
    );

    // Add to live activity
    liveActivityService.addActivity(
      "task_complete",
      identity.username,
      `completed a task`,
      reward
    );

    toast.success(`Task completed! +${formatCurrency(reward)} earned`);
    setSelectedTask(null);
  };

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{t("tasks.title", "Task Marketplace")}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Complete tasks and earn rewards instantly (Free: 35%, Verified: 45%, VIP: 65% rewards)
            </p>
          </div>
          <Button
            onClick={() => navigate("/task-manager")}
            variant="outline"
            size="sm"
            className="border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">My Tasks</span>
          </Button>
        </div>

        {/* Create Task & VIP Buttons - Above Search */}
        <div className="flex items-center justify-between mb-1">
          {/* VIP Button - Left */}
          {isVIP ? (
            <Badge className="bg-green-600 h-7 px-2.5 text-xs" style={{ transform: "scale(0.9, 0.75)" }}>
              <Crown className="h-3.5 w-3.5 mr-1.5" />
              VIP Active
            </Badge>
          ) : (
            <Button
              onClick={() => navigate("/wallet")}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              style={{ transform: "scale(0.85, 0.75)" }}
            >
              <UnlockKeyhole className="h-3.5 w-3.5 mr-1.5" />
              Get VIP
            </Button>
          )}

          {/* Create Task Button - Right */}
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-sm"
            style={{ transform: "scale(0.85)" }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Create Task</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

      </div>

      <FeaturedPromotionCard location="marketplace" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{availableTasks.length}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Available Tasks</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{completedTaskIds.length}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Completed</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                {isVIP ? (
                  <Crown className="h-4 w-4 text-purple-400" />
                ) : (
                  <Clock className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{isVIP ? "65%" : isVerified ? "45%" : "35%"}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Your Reward Rate</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(
                availableTasks.reduce(
                  (sum, t) => sum + getUserReward(t),
                  0
                )
              )}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Potential Earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Task List - DESKTOP TABLE */}
      <div className="hidden lg:block">
        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-300 dark:border-slate-700/50 bg-gray-200 dark:bg-slate-900/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Your Reward
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 dark:divide-slate-700/30">
                  {filteredTasks.map((task) => {
                    const typeInfo = getTaskTypeInfo(task.type);
                    const userReward = getUserReward(task);
                    const progress = (task.completedSlots / task.totalSlots) * 100;

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-gray-200 dark:hover:bg-slate-900/20 transition-colors cursor-pointer"
                        onClick={() => handleStartTask(task)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {task.campaignImageUrl ? (
                              <img src={task.campaignImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            ) : (
                              <CategoryIcon categoryId={task.type} size={22} />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{task.title}</p>
                              <p className="text-xs text-gray-500">{typeInfo.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={`text-xs font-medium ${
                            task.status === "active" ? "bg-green-500/10 border border-green-500/20 text-green-500" :
                            task.status === "pending_review" ? "bg-amber-500/10 border border-amber-500/20 text-amber-500" :
                            task.status === "paused" ? "bg-gray-500/10 border border-gray-500/20 text-gray-500" :
                            "bg-blue-500/10 border border-blue-500/20 text-blue-500"
                          }`}>
                            {task.status === "pending_review" ? "Pending" : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-lg font-bold text-green-400">
                              {formatCurrency(userReward)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {getUserTierLabel()}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {task.completedSlots.toLocaleString()} /{" "}
                                {task.totalSlots.toLocaleString()}
                              </span>
                              <span className="text-xs text-gray-500">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-300 dark:bg-slate-700/30 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {task.remainingSlots.toLocaleString()} slots left
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartTask(task);
                            }}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Start Task
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTasks.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-gray-600 dark:text-gray-400">No tasks available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task List - MOBILE CARDS */}
      <div className="lg:hidden space-y-4">
        {filteredTasks.map((task) => {
          const typeInfo = getTaskTypeInfo(task.type);
          const userReward = getUserReward(task);
          const progress = (task.completedSlots / task.totalSlots) * 100;

          return (
            <Card
              key={task.id}
              className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-800/70 transition-colors"
              onClick={() => handleStartTask(task)}
            >
              <CardContent className="p-4">
                {/* Campaign image (if set) */}
                {task.campaignImageUrl && (
                  <div className="mb-3 rounded-xl overflow-hidden h-28 bg-gray-200 dark:bg-slate-700">
                    <img src={task.campaignImageUrl} alt={task.title} className="w-full h-full object-cover" />
                  </div>
                )}
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  {!task.campaignImageUrl && <CategoryIcon categoryId={task.type} size={22} />}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{task.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{typeInfo.label}</p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${
                    task.status === "active" ? "bg-green-500/10 border border-green-500/20 text-green-500" :
                    task.status === "pending_review" ? "bg-amber-500/10 border border-amber-500/20 text-amber-500" :
                    "bg-gray-500/10 border border-gray-500/20 text-gray-500"
                  }`}>
                    {task.status === "pending_review" ? "Pending" : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                  </Badge>
                </div>

                {/* Reward */}
                <div className="mb-3 p-3 bg-gray-200 dark:bg-slate-900/30 border border-gray-300 dark:border-slate-700/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Your Reward</p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(userReward)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {getUserTierLabel()} • Total: {formatCurrency(task.totalReward)}
                      </p>
                    </div>
                    {isVIP && <Crown className="h-5 w-5 text-purple-400" />}
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">
                      {task.completedSlots.toLocaleString()} / {task.totalSlots.toLocaleString()}{" "}
                      completed
                    </span>
                    <span className="text-xs text-gray-500">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-300 dark:bg-slate-700/30 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {task.remainingSlots.toLocaleString()} slots remaining
                  </p>
                </div>

                {/* CTA */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartTask(task);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start Task
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {filteredTasks.length === 0 && (
          <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
            <CardContent className="py-16 text-center">
              <p className="text-gray-400">No tasks available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isVIP={isVIP}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          loadCustomTasks(); // Reload tasks when modal closes
        }}
      />
    </ResponsiveLayout>
  );
}