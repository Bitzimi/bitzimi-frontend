/**
 * Task Verification Service — localStorage scaffolding layer.
 *
 * NOTE: This service is NOT used by the active frontend bundle.
 * Task proof submission and AI verification are handled server-side via:
 *   POST /api/v1/tasks/:id/proofs  →  backend/src/modules/tasks/proofs.service.ts
 *   GET  /api/v1/tasks/:id/proofs/me  (status polling)
 *
 * The backend uses ANTHROPIC_API_KEY (server-side env var, never sent to browser).
 * No Anthropic API calls are made from the frontend. Do not add VITE_ANTHROPIC_API_KEY.
 */

import { VerificationConfig } from "../config/VerificationConfig";
const { AUTO_APPROVE_THRESHOLD, MANUAL_REVIEW_THRESHOLD } = VerificationConfig;

export type ProofStatus =
  | "pending_ai" | "approved" | "review" | "rejected"
  | "admin_approved" | "admin_rejected";

export interface TaskProofSubmission {
  id: string; taskId: string; userId: string; username: string;
  screenshotDataUrl: string;
  additionalScreenshotDataUrls?: string[];  // Proof slots 2 & 3
  proofUsername?: string; proofLink?: string; proofEmail?: string; proofNote?: string;
  status: ProofStatus; aiConfidence: number; aiAnalysis: string;
  submittedAt: string; processedAt?: string;
  rewardAmount: number; rewardPaid: boolean;
}

export interface AdminReviewItem {
  id: string; proofId: string; taskId: string; taskTitle: string;
  userId: string; username: string;
  aiConfidence: number; aiAnalysis: string;
  screenshotDataUrl: string; additionalScreenshotDataUrls?: string[];
  advertiserReferenceUrls: string[]; taskInstructions: string;
  rewardAmount: number; createdAt: string; reviewedAt?: string;
  decision?: "approved" | "rejected"; decisionNote?: string;
}

const PROOFS_KEY = "bitzimiTaskProofs";
const ADMIN_KEY  = "bitzimiAdminReviewQueue";

// ── Platform-specific verification guidance ────────────────────────────────

function platformGuide(cat: string): string {
  const g: Record<string,string> = {
    telegram: `
TELEGRAM CHANNEL: STRONG APPROVE if → channel name matches AND join button absent AND "You joined this channel" visible.
Also accept: notification bell visible, muted/unmute option shown (proves membership).
MEDIUM: similar logo, layout, header, pinned message area.
WEAK (don't reject for): exact subscriber count (changes constantly); exact post content.
REJECT: join button still visible; wrong channel name/branding.
TELEGRAM GROUP: STRONG APPROVE if → group name matches AND join button absent AND message input field visible at bottom.
Also accept: attachment icon, emoji icon, camera icon visible in chat bar (all prove membership).
NOTE: "You joined this group" may be deleted by bots — its absence is NOT a failure.
REJECT: join button still visible; wrong group.`,

    twitter_x: `
X (TWITTER): STRONG APPROVE (follow) → target handle visible AND "Following" button state shown (greyed/disabled/filled).
STRONG APPROVE (like) → heart icon filled/highlighted on correct post.
STRONG APPROVE (repost) → repost icon highlighted; count shown.
MEDIUM: profile photo, bio, banner match reference.
REJECT: active blue "Follow" button still shown; wrong profile.
FRAUD: photoshopped button states; impossible UI; inconsistent fonts/spacing/colours.`,

    instagram: `
INSTAGRAM: STRONG APPROVE (follow) → username matches AND "Following" label visible AND "Message" button visible (appears only after following).
STRONG APPROVE (like) → heart icon filled red on correct post.
STRONG APPROVE (comment) → user's comment visible under the post.
MEDIUM: profile photo, bio, post grid match reference.
REJECT: active "Follow" button still shown; wrong profile.
FRAUD: edited UI; impossible states; mismatched styling.`,

    youtube: `
YOUTUBE: STRONG APPROVE (subscribe) → channel name matches AND "Subscribed"/"Joined" state visible AND bell icon active.
STRONG APPROVE (like) → thumbs-up highlighted blue on correct video.
MEDIUM: channel banner and logo match reference.
REJECT: red "Subscribe" button still shown; wrong channel.
FRAUD: edited subscription state.`,

    facebook: `
FACEBOOK: STRONG APPROVE (page) → "Liked"/"Following" badge visible; active engagement state.
STRONG APPROVE (group) → "Member" badge or group feed showing user has access.
MEDIUM: page photo/cover similar to reference.
REJECT: active "Like"/"Join Group" button still shown; wrong page/group.`,

    discord: `
DISCORD: STRONG APPROVE → server name visible in sidebar AND channel list visible (proves server access) AND chat interface active.
MEDIUM: server icon matches reference.
REJECT: "Join Server" button or invite link still shown; server absent from sidebar.`,

    website_visit: `
WEBSITE VISIT: STRONG APPROVE → correct URL in browser address bar AND page content matches reference.
MEDIUM: layout and branding consistent.
REJECT: wrong website; URL doesn't match.`,

    app_download_registration: `
APP DOWNLOAD/REGISTRATION: STRONG APPROVE → app open/running AND welcome screen or dashboard visible AND user profile/account shown.
MEDIUM: app branding matches reference.
REJECT: no evidence of installation or account creation.`,
  };
  return g[cat] ?? `
GENERAL TASK: Compare proof against references contextually — not pixel-perfect.
Focus on IDENTITY match and ACTION COMPLETION evidence.
Content changes over time (counts, posts) — this is normal.
Strong signals: name/handle match, action-complete UI state.
Reject only with clear evidence of failure or fraud.`;
}

// ── AI Verdict type ────────────────────────────────────────────────────────

interface AIVerdict {
  confidence: number;
  verdict: "approved" | "review" | "rejected";
  analysis: string;
  strongSignals: string[];
  weaknesses: string[];
  fraudFlags: string[];
}

// AI verification is handled server-side via POST /api/v1/tasks/:id/proofs.
// The backend uses ANTHROPIC_API_KEY (process.env, never exposed to the browser).
// This stub routes any legacy calls through manual review — it never calls the
// Anthropic API directly and never reads any browser-accessible environment variable.
async function callClaudeVision(_p: unknown): Promise<AIVerdict> {
  return {
    confidence: 72,
    verdict: "review",
    analysis: "AI verification is handled by the backend. This proof has been routed to manual review.",
    strongSignals: [],
    weaknesses: ["Use POST /api/v1/tasks/:id/proofs for server-side verification"],
    fraudFlags: [],
  };
}

// ── Service ────────────────────────────────────────────────────────────────

class TaskVerificationService {
  private load(): TaskProofSubmission[]  { try { return JSON.parse(localStorage.getItem(PROOFS_KEY)||"[]"); } catch { return []; } }
  private save(p: TaskProofSubmission[]) { localStorage.setItem(PROOFS_KEY, JSON.stringify(p)); }
  private loadQ(): AdminReviewItem[]     { try { return JSON.parse(localStorage.getItem(ADMIN_KEY)||"[]"); } catch { return []; } }
  private saveQ(q: AdminReviewItem[])    { localStorage.setItem(ADMIN_KEY, JSON.stringify(q)); }

  private createRecord(p: {
    taskId:string; userId:string; username:string;
    screenshotDataUrl:string; additionalScreenshotDataUrls?:string[];
    proofUsername?:string; proofLink?:string; proofEmail?:string; proofNote?:string;
    rewardAmount:number;
  }): TaskProofSubmission {
    const proof: TaskProofSubmission = {
      id:`proof_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      ...p, status:"pending_ai", aiConfidence:0,
      aiAnalysis:"Awaiting AI verification…",
      submittedAt:new Date().toISOString(), rewardPaid:false,
    };
    const all = this.load(); all.unshift(proof); this.save(all); return proof;
  }

  private async runAI(p: {
    proofId:string; proofScreenshots:string[]; referenceScreenshots:string[];
    taskTitle:string; taskInstructions:string; categoryId:string; taskLink:string;
    proofUsername?:string; proofLink?:string; proofEmail?:string;
  }): Promise<void> {
    let v: AIVerdict;
    try {
      v = await callClaudeVision({
        proofScreenshots:p.proofScreenshots, referenceScreenshots:p.referenceScreenshots,
        taskTitle:p.taskTitle, taskInstructions:p.taskInstructions,
        categoryId:p.categoryId, taskLink:p.taskLink,
        proofUsername:p.proofUsername, proofLink:p.proofLink, proofEmail:p.proofEmail,
      });
    } catch(err) {
      console.error("[TaskVerification] Claude API error:", err);
      // Error → manual review, never fake-approve
      v = { confidence:72, verdict:"review",
        analysis:"AI verification encountered a technical error. Proof routed to manual review.",
        strongSignals:[], weaknesses:["Verification service error"], fraudFlags:[] };
    }

    const all = this.load();
    const idx = all.findIndex(x => x.id === p.proofId);
    if (idx === -1) return;
    const proof = all[idx];

    if (v.verdict === "approved") {
      proof.status = "approved"; proof.rewardPaid = true;
    } else if (v.verdict === "review") {
      proof.status = "review";
      const q = this.loadQ();
      if (!q.some(r => r.proofId === proof.id)) {
        q.unshift({
          id:`review_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          proofId:proof.id, taskId:proof.taskId, taskTitle:p.taskTitle,
          userId:proof.userId, username:proof.username,
          aiConfidence:v.confidence, aiAnalysis:v.analysis,
          screenshotDataUrl:proof.screenshotDataUrl,
          additionalScreenshotDataUrls:proof.additionalScreenshotDataUrls,
          advertiserReferenceUrls:p.referenceScreenshots,
          taskInstructions:p.taskInstructions,
          rewardAmount:proof.rewardAmount, createdAt:new Date().toISOString(),
        });
        this.saveQ(q);
      }
    } else {
      proof.status = "rejected";
    }

    proof.aiConfidence = v.confidence;
    proof.aiAnalysis = [
      v.analysis,
      v.strongSignals.length ? `Evidence: ${v.strongSignals.join("; ")}.` : "",
      v.weaknesses.length ? `Concerns: ${v.weaknesses.join("; ")}.` : "",
      v.fraudFlags.length ? `⚠ Fraud: ${v.fraudFlags.join("; ")}.` : "",
    ].filter(Boolean).join(" ");
    proof.processedAt = new Date().toISOString();
    all[idx] = proof; this.save(all);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  async submitProofAsync(p: {
    taskId:string; userId:string; username:string;
    screenshotDataUrl:string; additionalScreenshotDataUrls?:string[];
    rewardAmount:number; fileSizeBytes?:number; mimeType?:string;
    proofUsername?:string; proofWalletAddress?:string; proofLink?:string;
    proofEmail?:string; proofCustomNote?:string;
    taskTitle?:string; taskInstructions?:string; categoryId?:string; taskLink?:string;
    advertiserReferenceUrls?:string[];
  }): Promise<{proof:TaskProofSubmission; isReuse:boolean; reuseReason?:string}> {
    // Idempotency
    const ex = this.load().find(x => x.userId===p.userId && x.taskId===p.taskId);
    if (ex) return { proof:ex, isReuse:false };

    // Anti-replay — duplicate screenshot detection
    if (p.screenshotDataUrl?.length > 100) {
      const pref = p.screenshotDataUrl.slice(0,300);
      const all = this.load();
      const su = all.find(x => x.screenshotDataUrl?.length>100 && x.screenshotDataUrl.slice(0,300)===pref && x.userId===p.userId);
      if (su) return { proof:su, isReuse:true, reuseReason:"This screenshot was already used for another task. Each proof must be unique." };
      const xu = all.find(x => x.screenshotDataUrl?.length>100 && x.screenshotDataUrl.slice(0,300)===pref && x.userId!==p.userId);
      if (xu) return { proof:xu, isReuse:true, reuseReason:"This screenshot was already submitted by another user and cannot be reused." };
    }

    const proof = this.createRecord({
      taskId:p.taskId, userId:p.userId, username:p.username,
      screenshotDataUrl:p.screenshotDataUrl,
      additionalScreenshotDataUrls:p.additionalScreenshotDataUrls,
      rewardAmount:p.rewardAmount,
      proofUsername:p.proofUsername, proofLink:p.proofLink,
      proofEmail:p.proofEmail, proofNote:p.proofCustomNote,
    });

    const allShots = [p.screenshotDataUrl, ...(p.additionalScreenshotDataUrls??[])].filter(s=>s?.length>100);

    // Fire-and-forget — TaskModal polls getProofStatus()
    this.runAI({
      proofId:proof.id, proofScreenshots:allShots,
      referenceScreenshots:p.advertiserReferenceUrls??[],
      taskTitle:p.taskTitle??"Task", taskInstructions:p.taskInstructions??"",
      categoryId:p.categoryId??"custom", taskLink:p.taskLink??"",
      proofUsername:p.proofUsername, proofLink:p.proofLink, proofEmail:p.proofEmail,
    }).catch(e => console.error("[TaskVerification] Background error:", e));

    return { proof, isReuse:false };
  }

  async getProofStatus(userId:string, taskId:string): Promise<TaskProofSubmission|null> {
    return this.load().find(p => p.userId===userId && p.taskId===taskId) ?? null;
  }

  adminDecide(reviewId:string, decision:"approved"|"rejected", note?:string): {success:boolean; proof?:TaskProofSubmission} {
    const q = this.loadQ();
    const idx = q.findIndex(r => r.id===reviewId);
    if (idx===-1 || q[idx].decision) return { success:false };
    q[idx] = {...q[idx], decision, decisionNote:note, reviewedAt:new Date().toISOString()};
    this.saveQ(q);
    const all = this.load();
    const pIdx = all.findIndex(p => p.id===q[idx].proofId);
    if (pIdx !== -1) {
      all[pIdx].status = decision==="approved" ? "admin_approved" : "admin_rejected";
      if (decision==="approved") all[pIdx].rewardPaid = true;
      all[pIdx].processedAt = new Date().toISOString();
      this.save(all);
      return { success:true, proof:all[pIdx] };
    }
    return { success:true };
  }

  getAdminQueue(): AdminReviewItem[]   { return this.loadQ().filter(r => !r.decision); }
  getAllAdminItems(): AdminReviewItem[] { return this.loadQ(); }
  getUserProofs(userId:string): TaskProofSubmission[] { return this.load().filter(p => p.userId===userId); }
  hasUserSubmittedProof(userId:string, taskId:string): boolean { return this.load().some(p => p.userId===userId && p.taskId===taskId); }
}

export const taskVerificationService = new TaskVerificationService();
