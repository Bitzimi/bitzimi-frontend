/**
 * ITaskReferenceRepository — abstract interface for advertiser reference screenshots.
 */

export interface TaskReferenceRecord {
  id: string;
  taskId: string;
  advertiserId: string;            // Bitzimi identity.userId
  dataUrl: string;                 // base64 Data URL (replaced by storage URL in production)
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sortOrder: number;               // 0-based order for display
  uploadedAt: string;
  scheduledDeleteAt?: string;
  storageType: "local" | "supabase" | "s3";
  referenceType: "advertiser_reference";
}

export interface ITaskReferenceRepository {
  create(ref: Omit<TaskReferenceRecord, "id" | "uploadedAt">): Promise<TaskReferenceRecord>;
  findByTask(taskId: string): Promise<TaskReferenceRecord[]>;
  findById(id: string): Promise<TaskReferenceRecord | null>;
  delete(id: string): Promise<boolean>;
  reorder(taskId: string, orderedIds: string[]): Promise<boolean>;
}
