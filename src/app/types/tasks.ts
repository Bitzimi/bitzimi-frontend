export interface Task {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  imageUrl: string;
  taskLink: string;
  rewardPerUser: number;
  totalBudget: number;
  budgetUsed: number;
  remainingSlots: number;
  status: "active" | "paused" | "completed";
  createdBy: string;
  createdAt: string;
  extraInstructions?: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  userId: string;
  proofUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
}
