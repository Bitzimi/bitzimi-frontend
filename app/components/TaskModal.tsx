import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  ExternalLink, CheckCircle2, Crown, XCircle, Loader2, Clock,
  Upload, ImageIcon, X, ShieldCheck, Plus,
} from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useTransactions } from "../contexts/TransactionContext";
import { useVerification } from "../contexts/VerificationContext";
import { useIdentity } from "../contexts/IdentityContext";
import { useNotifications } from "../contexts/NotificationContext";
import type { Task } from "../pages/Tasks";
import { TASK_TYPES, CategoryIcon } from "../pages/Tasks";
import { toast } from "sonner";
import { trackLinkOpened, canVerifyTask } from "../utils/taskVerification";
import { VerificationConfig } from "../config/VerificationConfig";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getAuthToken() { return localStorage.getItem("bitzimi_access_token"); }

const MAX_PROOF_SLOTS = 3;

interface TaskModalProps {
  task: Task; isVIP: boolean; open: boolean;
  onClose: () => void; onComplete: (taskId: string, reward: number) => void;
}
type SubmitState = "idle"|"submitting"|"pending_ai"|"approved"|"review"|"rejected"|"reuse_error";
interface ProofSlot { dataUrl: string; size: number; mimeType: string; }
interface ProofReqs {
  screenshotRequired: boolean; usernameRequired: boolean;
  walletAddressRequired: boolean; linkRequired: boolean;
  emailRequired: boolean; customRequirement?: string;
}

export function TaskModal({ task, isVIP, open, onClose, onComplete }: TaskModalProps) {
  const { formatCurrency } = useSettings();
  const { refreshWalletsFromBackend } = useWallet();
  const { addTransaction } = useTransactions();
  const { isVerified } = useVerification();
  const { identity } = useIdentity();
  const { addNotification } = useNotifications();

  // Three dedicated file input refs — hooks must not be called inside loops
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2] as const;

  const [hasLink, setHasLink] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number|null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [err, setErr] = useState<string|null>(null);
  const [slots, setSlots] = useState<(ProofSlot|null)[]>([null,null,null]);
  const [uname, setUname] = useState("");
  const [uwallet, setUwallet] = useState("");
  const [ulink, setUlink] = useState("");
  const [uemail, setUemail] = useState("");
  const [ucustom, setUcustom] = useState("");

  const typeInfo = TASK_TYPES.find(t => t.value === task.type) ?? TASK_TYPES[TASK_TYPES.length - 1];
  const verRew = (task as any).verifiedUserReward ?? task.freeUserReward;
  const rew = isVIP ? task.vipUserReward : (isVerified ? verRew : task.freeUserReward);
  const rewLabel = isVIP ? "VIP · 65%" : (isVerified ? "Verified · 45%" : "Free · 35%");
  const reqs: ProofReqs = (task as any).proofRequirements ?? {
    screenshotRequired: true, usernameRequired: false,
    walletAddressRequired: false, linkRequired: false, emailRequired: false,
  };

  useEffect(() => {
    if (open) {
      setHasLink(false); setTimeLeft(null); setState("idle"); setErr(null);
      setSlots([null,null,null]);
      setUname(""); setUwallet(""); setUlink(""); setUemail(""); setUcustom("");
    }
  }, [open]);

  useEffect(() => {
    if (!hasLink) return;
    const iv = setInterval(() => { const s = canVerifyTask(task.id, task.type); setTimeLeft(s.timeRemaining || null); }, 1000);
    return () => clearInterval(iv);
  }, [hasLink, task.id, task.type]);

  const uploaded = slots.filter(Boolean).length;
  const canGo = hasLink && (timeLeft === null || timeLeft <= 0);

  const missing = () => {
    const m: string[] = [];
    if (reqs.screenshotRequired && !slots[0]) m.push("At least one screenshot");
    if (reqs.usernameRequired && !uname.trim()) m.push("Username");
    if (reqs.walletAddressRequired && !uwallet.trim()) m.push("Wallet address");
    if (reqs.linkRequired && !ulink.trim()) m.push("Link");
    if (reqs.emailRequired && !uemail.trim()) m.push("Email");
    return m;
  };

  const onLink = () => { trackLinkOpened(task.id, task.type); window.open(task.link, "_blank"); setHasLink(true); toast.info("Complete the task, then return to submit proof."); };

  const onUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Image files only"); return; }
    if (f.size > VerificationConfig.MAX_PROOF_SIZE_BYTES) { toast.error("Max 5 MB"); return; }
    const rd = new FileReader();
    rd.onload = ev => { if (ev.target?.result) setSlots(p => { const n=[...p] as (ProofSlot|null)[]; n[idx]={dataUrl:ev.target!.result as string,size:f.size,mimeType:f.type}; return n; }); };
    rd.readAsDataURL(f);
    const ref = refs[idx]; if (ref.current) ref.current.value = "";
  };

  const onRemove = (idx: number) => setSlots(p => { const n=[...p] as (ProofSlot|null)[]; n[idx]=null; return n; });

  const onSubmit = async () => {
    const m = missing(); if (m.length) { toast.error(`Required: ${m.join(", ")}`); return; }
    if (!API_BASE || !getAuthToken()) { toast.error("Backend connection required. Please log in."); return; }
    setState("submitting"); setErr(null);
    try {
      const valid = slots.filter((s): s is ProofSlot => s !== null);
      const screenshotDataUrls = valid.map(s => s.dataUrl);

      // Submit proof to backend — backend runs Claude Vision server-side
      const submitRes = await fetch(`${API_BASE}/api/v1/tasks/${task.id}/proofs`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          screenshotDataUrls,
          proofNote: ucustom || undefined,
          proofLink: ulink || undefined,
        }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}));
        const code = (err as any)?.error?.code ?? (err as any)?.code;
        if (code === "ALREADY_SUBMITTED") {
          setState("reuse_error");
          setErr("You have already submitted proof for this task.");
          return;
        }
        setErr((err as any)?.error?.message ?? "Submission failed.");
        setState("idle");
        return;
      }

      addNotification("proof_submitted","Proof Submitted",`${valid.length} screenshot${valid.length!==1?"s":""} submitted for "${task.title}". AI verifying…`,{taskId:task.id});
      setState("pending_ai");
      let attempts = 0;

      // Poll backend for AI verification result
      const poll = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await fetch(`${API_BASE}/api/v1/tasks/${task.id}/proofs/me`, {
            headers: { Authorization: `Bearer ${getAuthToken()}` },
          });
          if (!pollRes.ok) return;
          const json = await pollRes.json();
          const upd = json.data;
          if (!upd || upd.status === "pending_ai") {
            if (attempts >= 30) { clearInterval(poll); setState("review"); toast.info("Queued for manual review."); }
            return;
          }
          clearInterval(poll);
          if (upd.status === "approved" || upd.status === "admin_approved") {
            setState("approved");
            // Backend already credited task wallet — refresh display balance
            refreshWalletsFromBackend().catch(() => {});
            addTransaction({ type: "task_reward", amount: rew, status: "completed", description: `Task completed: ${task.title}`, metadata: { taskId: task.id, categoryId: task.type } });
            addNotification("proof_approved","Proof Approved — Reward Credited",`${formatCurrency(rew)} earned for "${task.title}"`,{taskId:task.id,reward:rew});
            toast.success(`Reward credited: ${formatCurrency(rew)}`);
            setTimeout(() => { onComplete(task.id, rew); }, 2000);
          } else if (upd.status === "review") {
            setState("review");
            addNotification("proof_submitted","Proof Under Review",`Your proof for "${task.title}" is under manual review.`,{taskId:task.id});
            toast.info("Under manual review. Reward held until approved.");
          } else {
            setState("rejected");
            const reason = upd.aiAnalysis || "Proof did not meet verification requirements.";
            setErr(reason);
            addNotification("proof_rejected","Proof Rejected",`Proof for "${task.title}" was rejected. ${reason}`,{taskId:task.id});
            toast.error("Proof rejected — see reason below.");
            setTimeout(() => { setState("idle"); setErr(null); }, 8000);
          }
        } catch { /* keep polling */ }
      }, 1000);
    } catch (e) { console.error(e); setState("idle"); setErr("Submission failed. Please try again."); toast.error("Submission failed."); }
  };

  const busy = state === "submitting" || state === "pending_ai";
  const showProof = hasLink || uploaded > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-700 max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-slate-700">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={task.type} size={20} />
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-white text-base leading-tight">{task.title}</DialogTitle>
                <DialogDescription className="text-gray-400 text-xs mt-0.5">{typeInfo.label}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Reward */}
          <div className="p-4 bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Your Reward</p>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(rew)}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">{isVIP&&<Crown className="h-3 w-3 text-amber-400"/>}{rewLabel}</p>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <p>Free: {formatCurrency(task.freeUserReward)}</p>
                <p>Verified: {formatCurrency(verRew)}</p>
                <p>VIP: {formatCurrency(task.vipUserReward)}</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Instructions</h4>
            <div className="p-3.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-gray-300 leading-relaxed whitespace-pre-line">{task.instructions}</div>
            {(task as any).additionalInstructions && <div className="mt-2 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl text-xs text-blue-200 leading-relaxed">{(task as any).additionalInstructions}</div>}
          </div>

          {/* Step 1 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Step 1 — Complete Task</h4>
            <Button onClick={onLink} variant="outline" className="w-full border-blue-500/30 hover:bg-blue-500/10 text-blue-400 justify-between h-10">
              <span className="truncate text-sm">{task.link}</span><ExternalLink className="h-3.5 w-3.5 ml-2 shrink-0"/>
            </Button>
            {hasLink && timeLeft !== null && timeLeft > 0 && <div className="mt-2 flex items-center gap-2 text-xs text-amber-400"><Clock className="h-3.5 w-3.5"/><span>Spend {timeLeft}s more on the task page</span></div>}
            {hasLink && (timeLeft===null||timeLeft<=0) && <div className="mt-2 flex items-center gap-2 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5"/><span>Ready to submit proof</span></div>}
          </div>

          {/* Step 2 */}
          {showProof && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2 — Submit Proof</h4>
                <span className="text-xs text-gray-500">{uploaded}/{MAX_PROOF_SLOTS} uploaded</span>
              </div>
              <div className="space-y-2 mb-3">
                {([0,1,2] as const).map(idx => {
                  const slot = slots[idx];
                  const req = idx===0 && reqs.screenshotRequired;
                  const prevOk = idx===0 || slots[idx-1]!==null;
                  if (!prevOk && !slot) return null;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-gray-400 text-xs">Screenshot {idx+1}{req&&<span className="text-red-400 ml-1">*</span>}{idx>0&&<span className="text-gray-600 ml-1">(optional)</span>}</Label>
                        {slot && <button onClick={()=>onRemove(idx)} className="text-gray-600 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5"/></button>}
                      </div>
                      {slot ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-600">
                          <img src={slot.dataUrl} alt={`Proof ${idx+1}`} className="w-full max-h-40 object-cover"/>
                          <div className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/70 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5"/>Uploaded</div>
                          <button onClick={()=>refs[idx].current?.click()} className="absolute top-1.5 left-1.5 text-[10px] bg-black/70 text-gray-300 hover:text-white px-2 py-0.5 rounded-full transition-colors">Replace</button>
                        </div>
                      ) : (
                        <button onClick={()=>refs[idx].current?.click()} className="w-full h-20 border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors text-gray-500 hover:text-blue-400">
                          {idx===0?<><ImageIcon className="h-5 w-5"/><span className="text-xs">Upload proof screenshot</span></>:<><Plus className="h-4 w-4"/><span className="text-xs">Add another screenshot</span></>}
                          <span className="text-[10px] text-gray-600">JPG, PNG, WEBP · Max 5 MB</span>
                        </button>
                      )}
                      <input ref={refs[idx]} type="file" accept="image/*" className="hidden" onChange={e=>onUpload(idx,e)}/>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                {reqs.usernameRequired&&<div className="space-y-1"><Label className="text-gray-300 text-sm">Username / Handle <span className="text-red-400">*</span></Label><Input value={uname} onChange={e=>setUname(e.target.value)} placeholder="@your_username" className="h-9 bg-slate-800 border-slate-700 text-white text-sm"/></div>}
                {reqs.walletAddressRequired&&<div className="space-y-1"><Label className="text-gray-300 text-sm">Wallet Address <span className="text-red-400">*</span></Label><Input value={uwallet} onChange={e=>setUwallet(e.target.value)} placeholder="0x…" className="h-9 bg-slate-800 border-slate-700 text-white text-sm font-mono"/></div>}
                {reqs.linkRequired&&<div className="space-y-1"><Label className="text-gray-300 text-sm">Link <span className="text-red-400">*</span></Label><Input value={ulink} onChange={e=>setUlink(e.target.value)} placeholder="https://…" type="url" className="h-9 bg-slate-800 border-slate-700 text-white text-sm"/></div>}
                {reqs.emailRequired&&<div className="space-y-1"><Label className="text-gray-300 text-sm">Email <span className="text-red-400">*</span></Label><Input value={uemail} onChange={e=>setUemail(e.target.value)} placeholder="you@example.com" type="email" className="h-9 bg-slate-800 border-slate-700 text-white text-sm"/></div>}
                {reqs.customRequirement&&<div className="space-y-1"><Label className="text-gray-300 text-sm">{reqs.customRequirement}</Label><Input value={ucustom} onChange={e=>setUcustom(e.target.value)} className="h-9 bg-slate-800 border-slate-700 text-white text-sm"/></div>}
              </div>
            </div>
          )}

          {state==="pending_ai"&&<div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3"><Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0"/><div><p className="text-sm text-blue-300 font-medium">AI is verifying your proof…</p><p className="text-xs text-blue-200/60 mt-0.5">Analyzing {uploaded} screenshot{uploaded!==1?"s":""} against task requirements</p></div></div>}
          {state==="approved"&&<div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-green-400 shrink-0"/><p className="text-sm text-green-300 font-medium">Approved! {formatCurrency(rew)} credited to your Task Wallet.</p></div>}
          {state==="review"&&<div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl"><div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-amber-400 shrink-0"/><p className="text-sm text-amber-300 font-medium">Under Manual Review</p></div><p className="text-xs text-amber-200/60 mt-1">Our team will review your proof. Reward credited upon approval.</p></div>}
          {(state==="rejected"||state==="reuse_error")&&err&&<div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl"><div className="flex items-start gap-3"><XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0"/><div><p className="text-sm text-red-300 font-medium">{state==="reuse_error"?"Screenshot Already Used":"Proof Rejected"}</p><p className="text-xs text-red-200/60 mt-0.5">{err}</p></div></div></div>}
        </div>

        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-slate-700 flex gap-3">
          <Button onClick={onClose} variant="outline" disabled={busy} className="flex-1 h-10 border-slate-600 text-white hover:bg-slate-800">Cancel</Button>
          <Button onClick={onSubmit} disabled={!canGo||busy||state==="approved"} className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
            {busy?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Verifying…</>:state==="approved"?<><CheckCircle2 className="h-4 w-4 mr-2"/>Approved!</>:<><Upload className="h-4 w-4 mr-2"/>Submit Proof</>}
          </Button>
        </div>
        {!hasLink&&<p className="text-xs text-center text-gray-500 pb-3 -mt-1">Open the task link first, then submit your proof</p>}
      </DialogContent>
    </Dialog>
  );
}
