import {
  getGenerationPollShardCount,
  getGenerationPollShardIndex,
} from "./poll-config";

/** 稳定字符串 hash → 非负整数（用于分片，无 DB 字段） */
export function hashPollShardKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function taskBelongsToPollShard(taskId: string): boolean {
  const count = getGenerationPollShardCount();
  if (count <= 1) return true;
  const index = getGenerationPollShardIndex();
  return hashPollShardKey(taskId) % count === index;
}

/**
 * 从候选任务中筛出本分片任务，最多 limit 条。
 * 调用方应 over-fetch（limit × shardCount × 2）以保证填满。
 */
export function selectPollShardTasks<T extends { id: string }>(
  candidates: T[],
  limit: number,
): T[] {
  if (getGenerationPollShardCount() <= 1) {
    return candidates.slice(0, limit);
  }
  const out: T[] = [];
  for (const t of candidates) {
    if (!taskBelongsToPollShard(t.id)) continue;
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

export function pollShardOverFetchSize(batch: number): number {
  const count = getGenerationPollShardCount();
  if (count <= 1) return batch;
  return Math.min(batch * count * 3, 2000);
}
