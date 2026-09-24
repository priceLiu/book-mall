/** 电商工作台最后打开的项目：localStorage 跨次访问仍在，sessionStorage 兼容旧入口。 */

export function readEcomLastProjectId(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  const local = window.localStorage.getItem(storageKey)?.trim();
  if (local) return local;
  return window.sessionStorage.getItem(storageKey)?.trim() || null;
}

export function writeEcomLastProjectId(storageKey: string, projectId: string): void {
  if (typeof window === "undefined") return;
  const id = projectId.trim();
  if (!id) return;
  window.localStorage.setItem(storageKey, id);
  window.sessionStorage.setItem(storageKey, id);
}

export function clearEcomLastProjectId(storageKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
}

export async function resumeOrCreateEcomProject<T extends { id: string }>(opts: {
  storageKey: string;
  getById: (id: string) => Promise<T>;
  /** 按更新时间倒序的项目 id，用于没有本地记录时恢复最近一次 */
  listRecentIds?: () => Promise<string[]>;
  create: () => Promise<T>;
}): Promise<{ project: T; created: boolean }> {
  const savedId = readEcomLastProjectId(opts.storageKey);
  if (savedId) {
    try {
      const project = await opts.getById(savedId);
      writeEcomLastProjectId(opts.storageKey, project.id);
      return { project, created: false };
    } catch {
      /* 已删或失效，改走最近项目 */
    }
  }

  const recentIds = opts.listRecentIds ? await opts.listRecentIds().catch(() => []) : [];
  const latestId = recentIds[0]?.trim();
  if (latestId) {
    try {
      const project = await opts.getById(latestId);
      writeEcomLastProjectId(opts.storageKey, project.id);
      return { project, created: false };
    } catch {
      /* 列表陈旧 */
    }
  }

  const project = await opts.create();
  writeEcomLastProjectId(opts.storageKey, project.id);
  return { project, created: true };
}
