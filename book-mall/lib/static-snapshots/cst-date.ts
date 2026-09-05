/** CST（UTC+8）业务日 · 与 platform-cockpit / site-traffic 一致 */

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

export function cstDateKey(now: Date = new Date()): string {
  const cst = new Date(now.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

export function previousCstDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d!) - 24 * 60 * 60 * 1000;
  const cst = new Date(utc + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

/** 确定性整数 seed（0..max-1） */
export function hashDateKeySeed(dateKey: string, salt: string, max: number): number {
  if (max <= 0) return 0;
  let h = 2166136261;
  const s = `${dateKey}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % max;
}

/** 按 dateKey 确定性洗牌（Fisher-Yates with seeded PRNG） */
export function seededShuffle<T>(items: T[], dateKey: string, salt: string): T[] {
  const out = [...items];
  let state = hashDateKeySeed(dateKey, salt, 0x7fffffff) + 1;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]!];
  }
  return out;
}

export const SNAPSHOT_RETAIN_DAYS = 14;
export const GENERATION_RUN_RETAIN_COUNT = 50;

export function snapshotPruneCutoffDateKey(now: Date = new Date()): string {
  const cst = new Date(now.getTime() + CST_OFFSET_MS - SNAPSHOT_RETAIN_DAYS * 24 * 60 * 60 * 1000);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}
