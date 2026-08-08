/**
 * ITaskRepository — abstract interface for task persistence.
 *
 * Current implementation: LocalTaskRepository (localStorage)
 * Future implementation: SupabaseTaskRepository (REST / realtime)
 *
 * Application logic MUST only call these methods — never touch storage directly.
 */

export interface TaskProofRequirements {
  screenshotRequired: boolean;
  usernameRequired: boolean;
  walletAddressRequired: boolean;
  linkRequired: boolean;
  emailRequired: boolean;
  customRequirement?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  categoryId: string;
  instructions: string;
  taskLink: string;
  additionalInstructions?: string;
  rewardPerUser: number;          // USD
  freeUserReward: number;         // USD (35%)
  verifiedUserReward: number;     // USD (45%)
  vipUserReward: number;          // USD (65%)
  totalBudget: number;            // USD
  totalSlots: number;
  completedSlots: number;
  remainingSlots: number;
  lockedBudget: number;
  budgetUsed: number;
  status: "pending_review" | "active" | "paused" | "completed" | "rejected";
  proofRequirements: TaskProofRequirements;
  referenceScreenshotIds: string[];  // IDs in ITaskReferenceRepository
  advertiserId: string;              // Bitzimi identity.userId — never a separate user table
  advertiserName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITaskRepository {
  create(task: Omit<TaskRecord, "id" | "createdAt" | "updatedAt">): Promise<TaskRecord>;
  findById(id: string): Promise<TaskRecord | null>;
  findAll(): Promise<TaskRecord[]>;
  findActive(): Promise<TaskRecord[]>;
  findByAdvertiser(advertiserId: string): Promise<TaskRecord[]>;
  update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord | null>;
  markSlotCompleted(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
