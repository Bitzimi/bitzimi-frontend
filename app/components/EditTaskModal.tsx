import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

interface ManagedTask {
  id: string;
  title: string;
  type: string;
  link: string;
  instructions: string;
  status: "pending" | "active" | "paused" | "completed" | "rejected";
  totalBudget: number;
  budgetUsed: number;
  budgetRemaining: number;
  rewardPerUser: number;
  totalSlots: number;
  completedSlots: number;
  remainingSlots: number;
  lockedBudget: number;
}

interface EditTaskModalProps {
  task: ManagedTask;
  open: boolean;
  onClose: () => void;
  onSave: (updatedTask: ManagedTask) => void;
}

export function EditTaskModal({ task, open, onClose, onSave }: EditTaskModalProps) {
  const { formatCurrency } = useSettings();

  const [title, setTitle] = useState(task.title);
  const [link, setLink] = useState(task.link);
  const [instructions, setInstructions] = useState(task.instructions);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setLink(task.link);
    setInstructions(task.instructions);
  }, [task]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Task title is required";
    if (!link.trim()) newErrors.link = "Task link is required";
    else if (!link.match(/^https?:\/\/.+/)) newErrors.link = "Please enter a valid URL";
    if (!instructions.trim()) newErrors.instructions = "Task instructions are required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) { toast.error("Please fix the errors in the form"); return; }
    if (!API_BASE || !getToken()) { toast.error("Backend connection required."); return; }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tasks/${task.id}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), link: link.trim(), description: instructions.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any)?.error?.message ?? "Failed to update task");
        return;
      }
      const json = await res.json();
      const updated = json.data;
      // Map backend response to ManagedTask shape
      const updatedTask: ManagedTask = {
        ...task,
        title:        updated.title ?? title,
        link:         updated.link  ?? link,
        instructions: updated.description ?? instructions,
      };
      toast.success("Task updated successfully!");
      onSave(updatedTask);
      onClose();
    } catch { toast.error("Failed to update task."); }
    finally { setIsSaving(false); }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Task</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update task details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Task Info */}
          <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-1">Current Budget</p>
                <p className="text-white font-semibold">{formatCurrency(task.totalBudget)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Budget Used</p>
                <p className="text-white font-semibold">{formatCurrency(task.budgetUsed)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Remaining Budget</p>
                <p className="text-white font-semibold">{formatCurrency(task.budgetRemaining)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Completions</p>
                <p className="text-white font-semibold">
                  {task.completedSlots} / {task.totalSlots}
                </p>
              </div>
            </div>
          </div>

          {/* Edit Fields */}
          <div className="space-y-4">
            {/* Task Title */}
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="text-white">
                Task Title
              </Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white ${
                  errors.title ? "border-red-500" : ""
                }`}
              />
              {errors.title && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* Task Link */}
            <div className="space-y-2">
              <Label htmlFor="edit-link" className="text-white">
                Task Link
              </Label>
              <Input
                id="edit-link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className={`bg-slate-800 border-slate-700 text-white ${
                  errors.link ? "border-red-500" : ""
                }`}
              />
              {errors.link && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.link}
                </p>
              )}
            </div>

            {/* Task Instructions */}
            <div className="space-y-2">
              <Label htmlFor="edit-instructions" className="text-white">
                Task Instructions
              </Label>
              <Textarea
                id="edit-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                className={`bg-slate-800 border-slate-700 text-white ${
                  errors.instructions ? "border-red-500" : ""
                }`}
              />
              {errors.instructions && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.instructions}
                </p>
              )}
            </div>

          </div>

          {/* Save Button */}
          <div className="flex gap-3 pt-4 border-t border-slate-700/50">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 border-slate-600 hover:bg-slate-800 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}