/** 打开画布项目 · 避免 history 堆叠「画布 A → 画布 B」导致浏览器后退串台 */

export function canvasProjectPath(projectId: string): string {
  return `/canvas/${projectId}`;
}

export function parseCanvasProjectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/canvas\/([^/?#]+)\/?$/);
  return m?.[1] ?? null;
}

export function isCanvasEditorPathname(pathname: string): boolean {
  return parseCanvasProjectIdFromPath(pathname) !== null;
}

/** popstate 后 URL 落在另一张画布上 → 须恢复为当前编辑中的项目 */
export function shouldRestoreCanvasHistoryLockOnPopstate(
  lockPath: string | null,
  currentPath: string,
): boolean {
  if (!lockPath || lockPath === currentPath) return false;
  return isCanvasEditorPathname(lockPath) && isCanvasEditorPathname(currentPath);
}

/** 整页跳转：已在另一张画布上时用 replace，避免后退回到上一张画布 */
export function assignCanvasProjectLocation(projectId: string): void {
  const href = canvasProjectPath(projectId);
  if (
    typeof window !== "undefined" &&
    isCanvasEditorPathname(window.location.pathname)
  ) {
    window.location.replace(href);
    return;
  }
  window.location.href = href;
}
