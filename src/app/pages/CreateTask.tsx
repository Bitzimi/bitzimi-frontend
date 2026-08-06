import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Minus, Plus, Upload, AlertCircle, Pause, Play, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useIdentity } from "../contexts/IdentityContext";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

interface ManagedTask {
  id: string;
  title: string;
  status: string;
  totalBudget: number;
  completedSlots: number;
  totalSlots: number;
  rewardPerSlot: number;
}

export default function CreateTask() {
  const navigate = useNavigate();
  const { formatCurrency, convertToUSD, convertCurrency, currency } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { identity } = useIdentity();

  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVipPopup, setShowVipPopup] = useState(false);

  const minRewardUSD = 0.10;
  const minBudgetUSD = 10;
  const minRewardDisplay = convertCurrency(minRewardUSD);
  const minBudgetDisplay = convertCurrency(minBudgetUSD);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    taskLink: "",
    rewardPerUser: minRewardDisplay,
    totalBudget: minBudgetDisplay,
    extraInstructions: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const rewardInUSD = convertToUSD(formData.rewardPerUser);
  const budgetInUSD = convertToUSD(formData.totalBudget);
  // Backend deducts from task wallet
  const hasInsufficientBalance = balances.task < budgetInUSD;
  const estimatedUsers = Math.floor(formData.totalBudget / formData.rewardPerUser);

  const loadTasks = useCallback(async () => {
    if (!API_BASE || !getToken()) { setLoadingTasks(false); return; }
    setLoadingTasks(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/mine`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoadingTasks(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "manage") loadTasks();
  }, [activeTab, loadTasks]);

  const handleRewardChange = (increment: boolean) => {
    const step = currency.code === "NGN" || currency.code === "KES" ? 10 : 0.10;
    setFormData(prev => ({ ...prev, rewardPerUser: Math.max(minRewardDisplay, prev.rewardPerUser + (increment ? step : -step)) }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!API_BASE || !getToken()) { toast.error("Backend connection required. Please log in."); return; }
    if (hasInsufficientBalance) { toast.error("Insufficient Task Wallet balance"); return; }
    if (budgetInUSD < minBudgetUSD) { toast.error(`Minimum budget is ${formatCurrency(minBudgetUSD)}`); return; }
    if (rewardInUSD < minRewardUSD) { toast.error(`Minimum reward is ${formatCurrency(minRewardUSD)}`); return; }

    setIsSubmitting(true);
    try {
      const totalSlots = Math.floor(budgetInUSD / rewardInUSD);
      const body: Record<string, any> = {
        title:         formData.title.trim(),
        description:   formData.description.trim(),
        type:          "custom_task",
        totalBudget:   budgetInUSD,
        rewardPerSlot: rewardInUSD,
        totalSlots,
        link:          formData.taskLink.trim() || undefined,
        proofInstructions: formData.extraInstructions.trim() || undefined,
        requirements: ["screenshotRequired"],
      };

      const res = await fetch(`${API_BASE}/api/v1/tasks`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = (err as any)?.error?.code ?? (err as any)?.code;
        if (code === "VIP_REQUIRED") { setShowVipPopup(true); return; }
        toast.error((err as any)?.error?.message ?? "Failed to create task");
        return;
      }

      refreshWalletsFromBackend().catch(() => {});
      toast.success("Task submitted for review!");
      setFormData({ title: "", description: "", taskLink: "", rewardPerUser: minRewardDisplay, totalBudget: minBudgetDisplay, extraInstructions: "" });
      setImageFile(null);
      setActiveTab("manage");
    } catch { toast.error("Failed to create task. Please try again."); }
    finally { setIsSubmitting(false); }
  };

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

  return (
    <ResponsiveLayout>
      <div className="mb-6">
        <h2 className="text-lg md:text-2xl font-semibold mb-2">Task Management</h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4">
          Create new tasks or manage your existing tasks
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant={activeTab === "create" ? "default" : "outline"} onClick={() => setActiveTab("create")} className="flex-1 h-11">Create Task</Button>
          <Button variant={activeTab === "manage" ? "default" : "outline"} onClick={() => setActiveTab("manage")} className="flex-1 h-11">Task Manager</Button>
        </div>
        {activeTab === "create" && hasInsufficientBalance && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Insufficient Task Wallet balance. Current: {formatCurrency(balances.task)}</AlertDescription>
          </Alert>
        )}
      </div>

      {activeTab === "create" && (
        <Card>
          <CardHeader><CardTitle>Task Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input id="title" placeholder="e.g., Follow us on Twitter" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Task Description</Label>
                <Textarea id="description" placeholder="Describe what users need to do..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskLink">Task Link</Label>
                <Input id="taskLink" type="url" placeholder="https://..." value={formData.taskLink} onChange={e => setFormData({ ...formData, taskLink: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Upload Image/Banner</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <input type="file" id="image" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <label htmlFor="image" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">{imageFile ? imageFile.name : "Click to upload or drag and drop"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                  </label>
                </div>
              </div>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Reward Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reward per User</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => handleRewardChange(false)} disabled={formData.rewardPerUser <= minRewardDisplay}><Minus className="h-4 w-4" /></Button>
                      <Input type="number" step="any" min="0" value={formData.rewardPerUser}
                        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setFormData({ ...formData, rewardPerUser: v }); }}
                        onBlur={() => { if (formData.rewardPerUser < minRewardDisplay) setFormData({ ...formData, rewardPerUser: minRewardDisplay }); }}
                        className="text-center font-mono" placeholder={`Min: ${minRewardDisplay.toFixed(2)}`} />
                      <Button type="button" variant="outline" size="icon" onClick={() => handleRewardChange(true)}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Minimum: {formatCurrency(minRewardUSD)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Total Budget</Label>
                    <Input id="budget" type="number" step="1" min={minBudgetDisplay} value={formData.totalBudget} onChange={e => setFormData({ ...formData, totalBudget: parseFloat(e.target.value) || minBudgetDisplay })} className="font-mono h-12" required />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Minimum: {formatCurrency(minBudgetUSD)}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">Budget is reserved from your Task Wallet and used to pay users as they complete your task.</p>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mt-2">Estimated reach: <span className="text-lg">{estimatedUsers}</span> users</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraInstructions">Extra Instructions (Optional)</Label>
                <Textarea id="extraInstructions" placeholder="Any additional instructions..." value={formData.extraInstructions} onChange={e => setFormData({ ...formData, extraInstructions: e.target.value })} rows={3} />
              </div>
              <Button type="submit" className="w-full h-11" disabled={hasInsufficientBalance || isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit Task"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "manage" && (
        <div className="space-y-4">
          {loadingTasks ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
          ) : tasks.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <AlertCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't created any tasks yet</p>
                <Button onClick={() => setActiveTab("create")}><Plus className="mr-2 h-4 w-4" />Create Your First Task</Button>
              </CardContent>
            </Card>
          ) : (
            tasks.map(task => {
              const budgetUsed = task.completedSlots * task.rewardPerSlot;
              const budgetPercentage = task.totalBudget > 0 ? (budgetUsed / task.totalBudget) * 100 : 0;
              const isPaused = task.status === "paused";
              const isCompleted = task.status === "completed";
              return (
                <Card key={task.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg truncate">{task.title}</CardTitle>
                      <Badge variant={task.status === "active" ? "default" : task.status === "paused" ? "secondary" : "outline"}>{task.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-gray-500">Reward/User</p><p className="font-medium text-green-600">{formatCurrency(task.rewardPerSlot)}</p></div>
                      <div><p className="text-gray-500">Budget Used</p><p className="font-medium">{formatCurrency(budgetUsed)}</p></div>
                      <div><p className="text-gray-500">Remaining</p><p className="font-medium">{formatCurrency(task.totalBudget - budgetUsed)}</p></div>
                      <div><p className="text-gray-500">Spots Left</p><p className="font-medium">{task.totalSlots - task.completedSlots}</p></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-gray-600">Progress</span><span className="font-medium">{budgetPercentage.toFixed(0)}%</span></div>
                      <Progress value={budgetPercentage} className="h-2" />
                    </div>
                    {!isCompleted && (
                      <Button variant={isPaused ? "default" : "outline"} className="w-full h-11" onClick={() => handleToggleStatus(task.id, task.status)}>
                        {isPaused ? <><Play className="mr-2 h-4 w-4" />Resume Task</> : <><Pause className="mr-2 h-4 w-4" />Pause Task</>}
                      </Button>
                    )}
                    {isCompleted && <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center text-sm text-gray-500">Task completed — all budget distributed.</div>}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {showVipPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Crown className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">VIP Required</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Only VIP members can create tasks. Upgrade your membership to start publishing task campaigns.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowVipPopup(false)}>Cancel</Button>
              <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => { setShowVipPopup(false); navigate("/wallet"); }}>Get VIP</Button>
            </div>
          </div>
        </div>
      )}
    </ResponsiveLayout>
  );
}
