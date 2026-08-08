/**
 * LocalTaskProofRepository — localStorage adapter for ITaskProofRepository.
 */

import type { ITaskProofRepository, ProofRecord, ProofStatus } from "./interfaces/ITaskProofRepository";

const STORAGE_KEY = "bitzimiTaskProofs_v2";

function load(): ProofRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(records: ProofRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function genId(): string {
  return `proof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

class LocalTaskProofRepository implements ITaskProofRepository {
  async create(proof: Omit<ProofRecord, "id" | "submittedAt">): Promise<ProofRecord> {
    const records = load();
    const record: ProofRecord = {
      ...proof,
      id: genId(),
      submittedAt: new Date().toISOString(),
    };
    records.unshift(record);
    save(records);
    return record;
  }

  async findById(id: string): Promise<ProofRecord | null> {
    return load().find(r => r.id === id) ?? null;
  }

  async findByUser(userId: string): Promise<ProofRecord[]> {
    return load().filter(r => r.userId === userId);
  }

  async findByTask(taskId: string): Promise<ProofRecord[]> {
    return load().filter(r => r.taskId === taskId);
  }

  async findByUserAndTask(userId: string, taskId: string): Promise<ProofRecord | null> {
    return load().find(r => r.userId === userId && r.taskId === taskId) ?? null;
  }

  async updateStatus(id: string, status: ProofStatus, aiConfidence?: number, aiAnalysis?: string): Promise<boolean> {
    const records = load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    records[idx] = {
      ...records[idx],
      status,
      ...(aiConfidence !== undefined && { aiConfidence }),
      ...(aiAnalysis !== undefined && { aiAnalysis }),
      processedAt: new Date().toISOString(),
    };
    save(records);
    return true;
  }

  async markRewardPaid(id: string): Promise<boolean> {
    const records = load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    records[idx] = { ...records[idx], rewardPaid: true };
    save(records);
    return true;
  }

  async findAllFingerprints() {
    return load().map(r => ({
      id: r.id,
      taskId: r.taskId,
      userId: r.userId,
      fingerprintAHash: r.fingerprintAHash,
      fingerprintDHash: r.fingerprintDHash,
    }));
  }
}

export const taskProofRepository: ITaskProofRepository = new LocalTaskProofRepository();
