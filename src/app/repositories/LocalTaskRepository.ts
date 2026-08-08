/**
 * LocalTaskRepository — localStorage adapter for ITaskRepository.
 *
 * All business logic calls ITaskRepository methods.
 * To migrate to Supabase: create SupabaseTaskRepository implementing ITaskRepository,
 * swap the exported singleton — zero changes elsewhere.
 */

import type { ITaskRepository, TaskRecord } from "./interfaces/ITaskRepository";

const STORAGE_KEY = "bitzimiTasks_v2";

function load(): TaskRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(records: TaskRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function now(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

class LocalTaskRepository implements ITaskRepository {
  async create(task: Omit<TaskRecord, "id" | "createdAt" | "updatedAt">): Promise<TaskRecord> {
    const records = load();
    const record: TaskRecord = {
      ...task,
      id: genId(),
      createdAt: now(),
      updatedAt: now(),
    };
    records.unshift(record);
    save(records);
    return record;
  }

  async findById(id: string): Promise<TaskRecord | null> {
    return load().find(r => r.id === id) ?? null;
  }

  async findAll(): Promise<TaskRecord[]> {
    return load();
  }

  async findActive(): Promise<TaskRecord[]> {
    return load().filter(r => r.status === "active" && r.remainingSlots > 0);
  }

  async findByAdvertiser(advertiserId: string): Promise<TaskRecord[]> {
    return load().filter(r => r.advertiserId === advertiserId);
  }

  async update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord | null> {
    const records = load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], ...patch, updatedAt: now() };
    save(records);
    return records[idx];
  }

  async markSlotCompleted(id: string): Promise<boolean> {
    const records = load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const task = records[idx];
    if (task.remainingSlots <= 0) return false;
    records[idx] = {
      ...task,
      completedSlots: task.completedSlots + 1,
      remainingSlots: task.remainingSlots - 1,
      status: task.remainingSlots - 1 <= 0 ? "completed" : task.status,
      updatedAt: now(),
    };
    save(records);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const records = load();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    save(filtered);
    return true;
  }
}

export const taskRepository: ITaskRepository = new LocalTaskRepository();
