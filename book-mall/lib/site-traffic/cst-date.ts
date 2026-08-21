/** CST（UTC+8）业务日 · 与 platform-cockpit-service 一致 */

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

export function cstDateKey(d: Date = new Date()): string {
  const cst = new Date(d.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

export function lastNCstDateKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(cstDateKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}
