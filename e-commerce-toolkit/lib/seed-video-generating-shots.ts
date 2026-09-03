import type { SeedVideoShot } from "@/lib/seed-video-types";
import { listPendingShotVideoIndices } from "@/lib/seed-video-pending-shots";
import type { SeedVideoProject } from "@/lib/seed-video-types";

/** pending 中排除已有 videoUrl 的镜号（DB 已落库但 meta 未清干净时） */
export function listEffectivePendingShotIndices(
  meta: SeedVideoProject["meta"],
  shots?: readonly SeedVideoShot[] | null,
): number[] {
  return listPendingShotVideoIndices(meta).filter((idx) => {
    const shot = shots?.find((s) => s.index === idx);
    return !shot?.videoUrl?.trim();
  });
}

/** 已有成片的镜号从 generating 集合移除 */
export function clearGeneratingShotsWithVideo(
  prev: ReadonlySet<number>,
  shots?: readonly SeedVideoShot[] | null,
): Set<number> {
  if (!shots?.length || prev.size === 0) return new Set(prev);
  const next = new Set(prev);
  for (const idx of prev) {
    const shot = shots.find((s) => s.index === idx);
    if (shot?.videoUrl?.trim()) next.delete(idx);
  }
  return next;
}

/** 乐观 generating 标记的默认过期时间：超过后若无服务端 pending 确认则视为「从未提交成功」并清除 */
export const OPTIMISTIC_GENERATING_TTL_MS = 3 * 60 * 1000;

/** 轮询服务端 pending 时保留本地 optimistic generating，避免提交前闪回「待生成」 */
export function mergeOptimisticGeneratingShots(opts: {
  previous: ReadonlySet<number>;
  serverPending: readonly number[];
  shots?: readonly SeedVideoShot[] | null;
  /** 各镜号本地标记 generating 的起始时间（Date.now）；过期且无 pending/视频则清除 */
  previousStartedAt?: ReadonlyMap<number, number>;
  now?: number;
  optimisticTtlMs?: number;
}): Set<number> {
  const shots = opts.shots ?? [];
  const now = opts.now ?? Date.now();
  const ttl = opts.optimisticTtlMs ?? OPTIMISTIC_GENERATING_TTL_MS;
  const next = new Set<number>();

  for (const idx of opts.serverPending) {
    const remote = shots.find((s) => s.index === idx);
    if (!remote?.videoUrl?.trim()) next.add(idx);
  }

  for (const idx of opts.previous) {
    if (next.has(idx)) continue;
    const remote = shots.find((s) => s.index === idx);
    if (remote?.videoUrl?.trim()) continue;
    const startedAt = opts.previousStartedAt?.get(idx);
    if (startedAt != null && now - startedAt > ttl) continue;
    next.add(idx);
  }

  return next;
}

export function seedVideoShotsHaveVoiceover(
  shots: readonly SeedVideoShot[],
  indices?: readonly number[],
): boolean {
  const targets =
    indices && indices.length > 0
      ? shots.filter((s) => indices.includes(s.index))
      : shots;
  return targets.some((s) => Boolean(s.voiceover?.trim()));
}

export function addGeneratingShot(prev: Set<number>, index: number): Set<number> {
  if (prev.has(index)) return prev;
  const next = new Set(prev);
  next.add(index);
  return next;
}

export function addGeneratingShots(
  prev: Set<number>,
  indices: Iterable<number>,
): Set<number> {
  let next = prev;
  for (const index of indices) {
    next = addGeneratingShot(next, index);
  }
  return next;
}

export function removeGeneratingShot(prev: Set<number>, index: number): Set<number> {
  if (!prev.has(index)) return prev;
  const next = new Set(prev);
  next.delete(index);
  return next;
}

/** 合并 generating + pending，已有 videoUrl 的镜号不再显示「生成中」 */
export function buildActiveGeneratingIndices(opts: {
  generatingShots: ReadonlySet<number>;
  pendingIndices: readonly number[];
  shots?: readonly SeedVideoShot[] | null;
}): Set<number> {
  const shots = opts.shots ?? [];
  const set = new Set<number>();

  const consider = (idx: number) => {
    const shot = shots.find((s) => s.index === idx);
    if (shot?.videoUrl?.trim()) return;
    set.add(idx);
  };

  for (const idx of opts.generatingShots) consider(idx);
  for (const idx of opts.pendingIndices) consider(idx);
  return set;
}
