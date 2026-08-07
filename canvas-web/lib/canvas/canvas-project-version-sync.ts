/** 轻量同步 project.updatedAt（不拉全量 canvas），避免乐观锁 409 */

let syncFn: (() => Promise<string | null>) | null = null;

export function registerCanvasProjectVersionSync(
  fn: (() => Promise<string | null>) | null,
): void {
  syncFn = fn;
}

/** 同步失败不抛出；成功返回最新 updatedAt */
export async function syncCanvasProjectVersionFromServer(): Promise<
  string | null
> {
  if (!syncFn) return null;
  try {
    return await syncFn();
  } catch {
    return null;
  }
}

/** 供 run-queue / 轮询：保存进行中时退避 tasks 轮询 */
let saveInFlight = false;

export function setCanvasSaveInFlight(v: boolean): void {
  saveInFlight = v;
}

export function isCanvasSaveInFlight(): boolean {
  return saveInFlight;
}
