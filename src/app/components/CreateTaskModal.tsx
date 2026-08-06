import { useState, useRef } from "react";
import { useNavigate } from "react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AlertCircle, Calculator, Wallet, CheckCircle2, Lock, Upload, X, ImageIcon, Star } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useIdentity } from "../contexts/IdentityContext";
import { useNotifications } from "../contexts/NotificationContext";
import { TASK_TYPES, CategoryIcon } from "../pages/Tasks";
import { getAmountTextSize } from "../utils/currencyHelpers";
import { VerificationConfig } from "../config/VerificationConfig";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getAuthToken() { return localStorage.getItem("bitzimi_access_token"); }

interface ProofRequirements {
  screenshotRequired: boolean;
  usernameRequired: boolean;
  walletAddressRequired: boolean;
  linkRequired: boolean;
  emailRequired: boolean;
  customRequirement: string;
}

interface ReferenceImage {
  dataUrl: string;
  name: string;
  size: number;
  mimeType: string;
}

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

const MIN_BUDGET = 10;
const MIN_REWARD = 0.1;
const MAX_REFS = VerificationConfig.MAX_REFERENCE_SCREENSHOTS;
const FREE_RATE = VerificationConfig.REWARD_DISTRIBUTION.free;
const VERIFIED_RATE = VerificationConfig.REWARD_DISTRIBUTION.verified;
const VIP_RATE = VerificationConfig.REWARD_DISTRIBUTION.vip;

export function CreateTaskModal({ open, onClose, onTaskCreated }: CreateTaskModalProps) {
  const { formatCurrency, currency, convertFromUSD } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { identity } = useIdentity();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [showVipPopup, setShowVipPopup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const campaignImageRef = useRef<HTMLInputElement>(null);

  // Campaign image
  const [campaignImage, setCampaignImage] = useState<{ dataUrl: string; name: string } | null>(null);

  // Core form fields
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [link, setLink] = useState("");
  const [instructions, setInstructions] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [rewardPerUser, setRewardPerUser] = useState("");
  const [totalBudget, setTotalBudget] = useState("");

  // Proof requirements
  const [proofReqs, setProofReqs] = useState<ProofRequirements>({
    screenshotRequired: true,
    usernameRequired: false,
    walletAddressRequired: false,
    linkRequired: false,
    emailRequired: false,
    customRequirement: "",
  });

  // Reference screenshots
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reward = parseFloat(rewardPerUser) || 0;
  const budget = parseFloat(totalBudget) || 0;
  const totalSlots = reward > 0 ? Math.floor(budget / reward) : 0;
  const freeReward = parseFloat((reward * FREE_RATE).toFixed(4));
  const verifiedReward = parseFloat((reward * VERIFIED_RATE).toFixed(4));
  const vipReward = parseFloat((reward * VIP_RATE).toFixed(4));
  const amountTextSize = getAmountTextSize(currency.rate, "2xl");

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_REFS - refImages.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_REFS} reference screenshots allowed`);
      return;
    }
    files.slice(0, remaining).forEach(file => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); return; }
      if (file.size > VerificationConfig.MAX_PROOF_SIZE_BYTES) { toast.error(`${file.name} is too large (max 5 MB)`); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          setRefImages(prev => [...prev, { dataUrl: ev.target!.result as string, name: file.name, size: file.size, mimeType: file.type }]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleProofReq = (key: keyof Omit<ProofRequirements, "customRequirement" | "screenshotRequired">) => {
    setProofReqs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Task title is required";
    if (!categoryId) e.categoryId = "Please select a category";
    if (!link.trim()) e.link = "Task link is required";
    else if (!/^https?:\/\/.+/.test(link)) e.link = "Must start with http:// or https://";
    if (!instructions.trim()) e.instructions = "Task instructions are required";
    if (!rewardPerUser || reward < MIN_REWARD) e.reward = `Minimum reward: ${formatCurrency(MIN_REWARD)}`;
    if (!totalBudget || budget < MIN_BUDGET) e.budget = `Minimum budget: ${formatCurrency(MIN_BUDGET)}`;
    // Backend deducts from task wallet — pre-check against task balance for UX
    if (budget > balances.task) e.budget = "Insufficient Task Wallet balance";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { toast.error("Please fix the form errors"); return; }
    if (!API_BASE || !getAuthToken()) {
      toast.error("Backend connection required. Please log in.");
      return;
    }
    setIsSubmitting(true);

    try {
      // Send to backend — backend validates VIP status, deducts task wallet → task_vault, creates task
      const body = {
        title:             title.trim(),
        type:              categoryId,
        totalBudget:       budget,
        rewardPerSlot:     reward,
        totalSlots,
        link:              link.trim() || undefined,
        description:       instructions.trim(),
        proofInstructions: additionalInstructions.trim() || undefined,
        requirements:      Object.entries(proofReqs)
          .filter(([k, v]) => k !== "customRequirement" && v === true)
          .map(([k]) => k),
        campaignImageUrl:  campaignImage?.dataUrl,
        referenceScreenshots: refImages.map(r => r.dataUrl),
      };

      const res = await fetch(`${API_BASE}/api/v1/tasks`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = (err as any)?.error?.code ?? (err as any)?.code;
        if (code === "VIP_REQUIRED") {
          // Show VIP required popup — do NOT close the modal
          setShowVipPopup(true);
          return;
        }
        toast.error((err as any)?.error?.message ?? "Failed to create task");
        return;
      }

      // Backend atomically deducted budget from task → task_vault — refresh balance
      refreshWalletsFromBackend().catch(() => {});

      toast.success(`Task submitted for review. ${formatCurrency(budget)} locked from your Task Wallet.`);
      addNotification(
        "task_created",
        "Task Submitted for Review",
        `Your task "${title}" was submitted and is awaiting admin approval.`,
        { taskTitle: title }
      );

      // Reset form
      setTitle(""); setCategoryId(""); setLink(""); setInstructions("");
      setAdditionalInstructions(""); setRewardPerUser(""); setTotalBudget("");
      setProofReqs({ screenshotRequired: true, usernameRequired: false, walletAddressRequired: false, linkRequired: false, emailRequired: false, customRequirement: "" });
      setRefImages([]); setErrors({}); setCampaignImage(null);
      onTaskCreated?.();
      onClose();
    } catch (err) {
      console.error("Task creation error:", err);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = !!(
    title.trim() && categoryId && link.trim() && instructions.trim() &&
    reward >= MIN_REWARD && budget >= MIN_BUDGET && budget <= balances.task
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white text-lg">Create New Task</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400 text-sm">
              Create a task campaign. Budget locked until tasks are verified and completed.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="create-task-form" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-6">

              {/* ── Left column: form fields ── */}
              <div className="space-y-4">

                {/* Campaign Image */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">
                    Campaign Image <span className="text-gray-400 font-normal text-xs">(optional — shown in task cards)</span>
                  </Label>
                  {campaignImage ? (
                    <div className="relative rounded-xl overflow-hidden h-28 border border-gray-200 dark:border-slate-600">
                      <img src={campaignImage.dataUrl} alt="Campaign" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={() => setCampaignImage(null)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button type="button"
                      onClick={() => campaignImageRef.current?.click()}
                      className="w-full h-20 border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-blue-400 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-blue-400 transition-colors">
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-xs">Upload campaign image</span>
                    </button>
                  )}
                  <input ref={campaignImageRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5 MB)"); return; }
                      const reader = new FileReader();
                      reader.onload = ev => {
                        if (ev.target?.result) setCampaignImage({ dataUrl: ev.target.result as string, name: file.name });
                      };
                      reader.readAsDataURL(file);
                      if (campaignImageRef.current) campaignImageRef.current.value = "";
                    }} />
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Task Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., Follow our X account and retweet"
                    className={`h-10 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 ${errors.title ? "border-red-500" : ""}`} />
                  {errors.title && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.title}</p>}
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Task Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className={`h-10 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white ${errors.categoryId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 max-h-60">
                      {TASK_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700">
                          <div className="flex items-center gap-2">
                            <CategoryIcon categoryId={t.value} size={15} />
                            <span className="text-sm">{t.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.categoryId}</p>}
                </div>

                {/* Task Link */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Task Link</Label>
                  <Input value={link} onChange={e => setLink(e.target.value)}
                    type="url" placeholder="https://..."
                    className={`h-10 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 ${errors.link ? "border-red-500" : ""}`} />
                  {errors.link && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.link}</p>}
                </div>

                {/* Instructions */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Task Instructions</Label>
                  <Textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                    placeholder="Describe exactly what users must do step by step…"
                    rows={3}
                    className={`bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 resize-none ${errors.instructions ? "border-red-500" : ""}`} />
                  {errors.instructions && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.instructions}</p>}
                </div>

                {/* Additional Instructions */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">
                    Additional Instructions <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </Label>
                  <Textarea value={additionalInstructions} onChange={e => setAdditionalInstructions(e.target.value)}
                    placeholder="Extra tips, notes, or special requirements…"
                    rows={2}
                    className="bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 resize-none" />
                </div>

                {/* Reward + Budget */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Reward / User</Label>
                    <Input value={rewardPerUser} onChange={e => setRewardPerUser(e.target.value)}
                      type="number" step="0.01" min={MIN_REWARD}
                      placeholder={String(convertFromUSD(0.5))}
                      className={`h-10 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 ${errors.reward ? "border-red-500" : ""}`} />
                    {errors.reward && <p className="text-xs text-red-500">{errors.reward}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Total Budget</Label>
                    <Input value={totalBudget} onChange={e => setTotalBudget(e.target.value)}
                      type="number" step="1" min={MIN_BUDGET}
                      placeholder={String(convertFromUSD(100))}
                      className={`h-10 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 ${errors.budget ? "border-red-500" : ""}`} />
                    {errors.budget && <p className="text-xs text-red-500">{errors.budget}</p>}
                  </div>
                </div>

                {/* Proof Requirements */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Proof Requirements</Label>
                  <div className="rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 p-3 space-y-2">
                    {[
                      { key: "screenshotRequired" as const, label: "Screenshot", locked: true, hint: "Always required" },
                      { key: "usernameRequired" as const, label: "Username / Handle", locked: false, hint: "Platform @username" },
                      { key: "walletAddressRequired" as const, label: "Wallet Address", locked: false, hint: "Crypto wallet" },
                      { key: "linkRequired" as const, label: "Profile / Post Link", locked: false, hint: "URL to proof" },
                      { key: "emailRequired" as const, label: "Email Address", locked: false, hint: "User email" },
                    ].map(item => (
                      <label key={item.key} className={`flex items-center justify-between py-0.5 ${item.locked ? "opacity-60" : "cursor-pointer"}`}>
                        <div className="flex items-center gap-2.5">
                          <button type="button"
                            onClick={() => !item.locked && item.key !== "screenshotRequired" && toggleProofReq(item.key as keyof Omit<ProofRequirements, "customRequirement" | "screenshotRequired">)}
                            className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
                              proofReqs[item.key]
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-300 dark:border-gray-500 bg-white dark:bg-slate-800"
                            }`}
                          >
                            {proofReqs[item.key] && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                          </button>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
                          {item.locked && <Lock className="h-3 w-3 text-gray-400" />}
                        </div>
                        <span className="text-xs text-gray-400">{item.hint}</span>
                      </label>
                    ))}
                    <div className="pt-1.5 border-t border-gray-200 dark:border-slate-600">
                      <Input value={proofReqs.customRequirement}
                        onChange={e => setProofReqs(prev => ({ ...prev, customRequirement: e.target.value }))}
                        placeholder="Custom requirement (e.g. Order confirmation number)"
                        className="h-8 text-xs bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600" />
                    </div>
                  </div>
                </div>

                {/* Reference Screenshots */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Reference Screenshots</Label>
                    <span className="text-xs text-gray-400">{refImages.length}/{MAX_REFS} uploaded</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Upload examples of expected proof. AI uses these as verification benchmarks.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {refImages.map((img, i) => (
                      <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
                        <img src={img.dataUrl} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button"
                          onClick={() => setRefImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">{i + 1}</span>
                      </div>
                    ))}
                    {refImages.length < MAX_REFS && (
                      <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/5 transition-colors flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-blue-400">
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px]">Add reference</span>
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleReferenceUpload} />
                </div>

              </div>

              {/* ── Right column: stats + guidance ── */}
              <div className="space-y-4">

                {/* Task Wallet Balance — budget is deducted from task wallet by backend */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-600 rounded-xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Wallet className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Task Wallet</p>
                  </div>
                  <p className={`${amountTextSize} font-bold text-gray-900 dark:text-white`}>{formatCurrency(balances.task)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Available for task budgets</p>
                </div>

                {/* Reward distribution calculator */}
                <div className="p-4 bg-blue-50 dark:bg-blue-500/8 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Distribution</p>
                  </div>
                  {reward > 0 && budget > 0 ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total user slots</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalSlots}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(budget)} ÷ {formatCurrency(reward)}</p>
                      </div>
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-500/20 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Free users (35%)</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(freeReward)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Verified users (45%)</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(verifiedReward)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">VIP users (65%)</span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(vipReward)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Enter reward and budget to preview</p>
                  )}
                </div>

                {/* Budget lock notice */}
                <div className="p-4 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Budget Locking</p>
                  </div>
                  <ul className="text-xs text-amber-700/80 dark:text-amber-200/70 space-y-1">
                    <li>• Full budget locked in Task Vault on submission</li>
                    <li>• Task goes to admin review before going live</li>
                    <li>• Deducted per verified completion</li>
                    <li>• Unused budget returned if task cancelled</li>
                  </ul>
                </div>

                {/* Featured Placement — available after task approval */}
                <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Star className="h-3.5 w-3.5 text-purple-400" />
                    <p className="text-xs font-semibold text-purple-400">Boost After Approval</p>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Once your task is approved, you can feature it on Wallet, Tasks, Referrals, Affiliate, and Ambassador pages from <span className="text-gray-700 dark:text-gray-300 font-medium">Task Manager</span>.
                  </p>
                </div>

                {/* Advertiser identity (single source of truth) */}
                <div className="p-3 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-600 rounded-xl">
                  <p className="text-xs text-gray-500 mb-0.5">Posting as</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{identity.username}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{identity.userId}</p>
                </div>

                {isFormValid && (
                  <div className="p-3 bg-green-50 dark:bg-green-500/8 border border-green-200 dark:border-green-500/20 rounded-xl flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Ready. {formatCurrency(budget)} will be locked from your Task Wallet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-gray-200 dark:border-slate-700 flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}
            className="flex-1 h-10 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white">
            Cancel
          </Button>
          <Button type="submit" form="create-task-form"
            disabled={!isFormValid || isSubmitting}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {isSubmitting ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Creating…</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Submit for Review</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* VIP Required Popup — shown when backend returns VIP_REQUIRED */}
    {showVipPopup && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-4xl">👑</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">VIP Required</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Only VIP members can create tasks. Upgrade your membership to start publishing task campaigns.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowVipPopup(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={() => { setShowVipPopup(false); onClose(); navigate("/wallet"); }}
            >
              Get VIP
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
