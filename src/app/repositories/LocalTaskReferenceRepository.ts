/**
 * LocalTaskReferenceRepository — localStorage adapter for ITaskReferenceRepository.
 */

import type { ITaskReferenceRepository, TaskReferenceRecord } from "./interfaces/ITaskReferenceRepository";

const STORAGE_KEY = "bitzimiTaskReferences_v2";

function load(): TaskReferenceRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(records: TaskReferenceRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

class LocalTaskReferenceRepository implements ITaskReferenceRepository {
  async create(ref: Omit<TaskReferenceRecord, "id" | "uploadedAt">): Promise<TaskReferenceRecord> {
    const records = load();
    const record: TaskReferenceRecord = {
      ...ref,
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };
    records.push(record);
    save(records);
    return record;
  }

  async findByTask(taskId: string): Promise<TaskReferenceRecord[]> {
    return load()
      .filter(r => r.taskId === taskId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findById(id: string): Promise<TaskReferenceRecord | null> {
    return load().find(r => r.id === id) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const records = load();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    save(filtered);
    return true;
  }

  async reorder(taskId: string, orderedIds: string[]): Promise<boolean> {
    const records = load();
    orderedIds.forEach((id, index) => {
      const idx = records.findIndex(r => r.id === id && r.taskId === taskId);
      if (idx !== -1) records[idx].sortOrder = index;
    });
    save(records);
    return true;
  }
}

export const taskReferenceRepository: ITaskReferenceRepository = new LocalTaskReferenceRepository();
