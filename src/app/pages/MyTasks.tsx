import { useState, useEffect, useCallback } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Pause, Play, PlusCircle, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

interface ManagedTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  totalBudget: number;
  completedSlots: number;
  totalSlots: number;
  rewardPerSlot: number;
}

export default function MyTasks() {
  const { formatCurrency } = useSettings();
  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!API_BASE || !getToken()) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/mine`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    if (!API_BASE || !getToken()) { toast.error("Backend connection required."); return; }
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error((e as any)?.error?.message ?? "Failed to update"); return; }
      toast.success(`Task ${newStatus === "active" ? "resumed" : "paused"}`);
      loadTasks();
    } catch { toast.error("Failed to update task."); }
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
      <div className="mb-6">
        <h2 className="text-lg md:text-2xl font-semibold mb-2">My Tasks</h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          Manage your created tasks and track their performance
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card className="text-center py-12 border-2 hover:shadow-lg transition-all">
          <CardContent>
            <PlusCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't created any tasks yet</p>
            <Link to="/create-task">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Task
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => {
            const budgetUsed = task.completedSlots * task.rewardPerSlot;
            const budgetPercentage = task.totalBudget > 0 ? (budgetUsed / task.totalBudget) * 100 : 0;
            const budgetRemaining = task.totalBudget - budgetUsed;
            const isPaused = task.status === "paused";
            const isCompleted = task.status === "completed";

            return (
              <Card key={task.id} className="border-2 hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2 truncate">{task.title}</CardTitle>
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    <Badge
                      variant={task.status === "active" ? "default" : task.status === "paused" ? "secondary" : "outline"}
                      className="shrink-0"
                    >
                      {task.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border-green-200 bg-green-50 dark:bg-black dark:border-green-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reward/User</p>
                      <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(task.rewardPerSlot)}</p>
                    </div>
                    <div className="border-blue-200 bg-blue-50 dark:bg-black dark:border-blue-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Budget Used</p>
                      <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(budgetUsed)}</p>
                    </div>
                    <div className="border-purple-200 bg-purple-50 dark:bg-black dark:border-purple-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Remaining</p>
                      <p className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(budgetRemaining)}</p>
                    </div>
                    <div className="border-orange-200 bg-orange-50 dark:bg-black dark:border-orange-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Spots Left</p>
                      <p className="font-bold text-orange-600 dark:text-orange-400">{task.totalSlots - task.completedSlots}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Budget Progress</span>
                      <span className="font-medium">{budgetPercentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={budgetPercentage} className="h-2" />
                  </div>

                  {!isCompleted && (
                    <div className="flex gap-2">
                      <Button
                        variant={isPaused ? "default" : "outline"}
                        className="flex-1 h-11"
                        onClick={() => handleToggleStatus(task.id, task.status)}
                      >
                        {isPaused ? (
                          <><Play className="mr-2 h-4 w-4" />Resume Task</>
                        ) : (
                          <><Pause className="mr-2 h-4 w-4" />Pause Task</>
                        )}
                      </Button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800 p-3 rounded-lg text-center">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Task completed — all budget distributed.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link to="/create-task">
          <Button className="w-full h-11">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Task
          </Button>
        </Link>
      </div>
    </ResponsiveLayout>
  );
}
