/**
 * ITaskProofRepository — abstract interface for proof submission persistence.
 */

export type ProofStatus =
  | "pending_ai"
  | "approved"
  | "review"
  | "rejected"
  | "admin_approved"
  | "admin_rejected";

export interface ProofRecord {
  id: string;                     // proof_${timestamp}_${random}
  taskId: string;
  userId: string;                 // Bitzimi identity.userId
  username: string;
  // Image data (base64 Data URL — replaced by storage URL in production)
  screenshotDataUrl: string;
  // Optional supplemental proof
  proofUsername?: string;
  proofWalletAddress?: string;
  proofLink?: string;
  proofEmail?: string;
  proofCustomNote?: string;
  // Integrity fingerprints (set by ProofIntegrityService)
  fingerprintAHash?: string;
  fingerprintDHash?: string;
  fingerprintColorSig?: string;
  imageWidthPx?: number;
  imageHeightPx?: number;
  fileSizeBytes?: number;
  // AI/Admin result
  status: ProofStatus;
  aiConfidence: number;
  aiAnalysis: string;
  // Timestamps
  submittedAt: string;
  processedAt?: string;
  // Reward
  rewardAmount: number;
  rewardPaid: boolean;
  // Retention
  scheduledDeleteAt?: string;
}

export interface ITaskProofRepository {
  create(proof: Omit<ProofRecord, "id" | "submittedAt">): Promise<ProofRecord>;
  findById(id: string): Promise<ProofRecord | null>;
  findByUser(userId: string): Promise<ProofRecord[]>;
  findByTask(taskId: string): Promise<ProofRecord[]>;
  findByUserAndTask(userId: string, taskId: string): Promise<ProofRecord | null>;
  updateStatus(id: string, status: ProofStatus, aiConfidence?: number, aiAnalysis?: string): Promise<boolean>;
  markRewardPaid(id: string): Promise<boolean>;
  findAllFingerprints(): Promise<Pick<ProofRecord, "id" | "taskId" | "userId" | "fingerprintAHash" | "fingerprintDHash">[]>;
}
