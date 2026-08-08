/**
 * StorageRetentionService — screenshot lifecycle management.
 *
 * Current storage: base64 dataUrls in localStorage (TaskReferenceRecord, ProofRecord)
 * Future storage: Supabase Storage / S3 (swap adapter without changing this service)
 *
 * Retention policy:
 *   Advertiser reference screenshots → delete 60 days after task completion
 *   User proof screenshots          → delete 60 days after task completion
 *
 * No orphan records. No orphan files.
 */

import { VerificationConfig } from "../config/VerificationConfig";
import { taskReferenceRepository } from "../repositories/LocalTaskReferenceRepository";
import { taskProofRepository } from "../repositories/LocalTaskProofRepository";
import { taskRepository } from "../repositories/LocalTaskRepository";

export interface RetentionMetadata {
  recordId: string;
  taskId: string;
  ownerId: string;
  uploadedAt: string;
  scheduledDeleteAt: string;
  referenceType: "advertiser_reference" | "user_proof";
  storageType: "local" | "supabase" | "s3";
}

const RETENTION_INDEX_KEY = "bitzimiStorageRetention";

function loadIndex(): RetentionMetadata[] {
  try {
    return JSON.parse(localStorage.getItem(RETENTION_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveIndex(index: RetentionMetadata[]): void {
  localStorage.setItem(RETENTION_INDEX_KEY, JSON.stringify(index));
}

class StorageRetentionService {
  /** Schedule a reference/proof screenshot for deletion after retention period */
  scheduleDeletion(params: {
    recordId: string;
    taskId: string;
    ownerId: string;
    uploadedAt: string;
    referenceType: "advertiser_reference" | "user_proof";
  }): void {
    const deleteAt = new Date(params.uploadedAt);
    deleteAt.setDate(deleteAt.getDate() + VerificationConfig.SCREENSHOT_RETENTION_DAYS);

    const index = loadIndex();
    // Idempotent — don't duplicate entries
    if (index.some(r => r.recordId === params.recordId)) return;
    index.push({
      ...params,
      scheduledDeleteAt: deleteAt.toISOString(),
      storageType: "local",
    });
    saveIndex(index);
  }

  /**
   * Schedule deletion for all reference/proof screenshots associated with a task.
   * Call this when a task moves to "completed" status.
   */
  async scheduleTaskDeletion(taskId: string): Promise<void> {
    const task = await taskRepository.findById(taskId);
    if (!task) return;

    const completionDate = new Date().toISOString();

    // Advertiser references
    const references = await taskReferenceRepository.findByTask(taskId);
    for (const ref of references) {
      this.scheduleDeletion({
        recordId: ref.id,
        taskId,
        ownerId: ref.advertiserId,
        uploadedAt: completionDate,
        referenceType: "advertiser_reference",
      });
    }

    // User proofs
    const proofs = await taskProofRepository.findByTask(taskId);
    for (const proof of proofs) {
      this.scheduleDeletion({
        recordId: proof.id,
        taskId,
        ownerId: proof.userId,
        uploadedAt: completionDate,
        referenceType: "user_proof",
      });
    }
  }

  /** Run cleanup of all expired records. Call on app startup or periodically. */
  async cleanupExpired(): Promise<{ deleted: number; errors: number }> {
    const index = loadIndex();
    const now = Date.now();
    let deleted = 0;
    let errors = 0;
    const remaining: RetentionMetadata[] = [];

    for (const item of index) {
      if (new Date(item.scheduledDeleteAt).getTime() <= now) {
        try {
          if (item.referenceType === "advertiser_reference") {
            await taskReferenceRepository.delete(item.recordId);
          } else {
            // For proof records, null out the screenshot data (fingerprints stay for audit)
            await this.nullifyProofScreenshot(item.recordId);
          }
          deleted++;
          // Don't add back to index — deletion complete
        } catch {
          errors++;
          remaining.push(item); // Retry next time
        }
      } else {
        remaining.push(item);
      }
    }

    saveIndex(remaining);
    return { deleted, errors };
  }

  private async nullifyProofScreenshot(proofId: string): Promise<void> {
    const STORAGE_KEY = "bitzimiTaskProofs_v2";
    try {
      const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const idx = records.findIndex((r: { id: string }) => r.id === proofId);
      if (idx !== -1) {
        records[idx].screenshotDataUrl = ""; // Clear data, keep metadata + fingerprints
        records[idx].scheduledDeleteAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }
    } catch {
      // Storage error — log and continue
    }
  }

  getPendingDeletions(): RetentionMetadata[] {
    return loadIndex();
  }

  getExpiredCount(): number {
    const now = Date.now();
    return loadIndex().filter(r => new Date(r.scheduledDeleteAt).getTime() <= now).length;
  }
}

export const storageRetentionService = new StorageRetentionService();
