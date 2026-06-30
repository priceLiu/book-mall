/** Pro2 媒体组顶栏 · 悬停保持（移向 portal 工具条时不立刻消失） */

export const PRO2_MEDIA_GROUP_TOOLBAR_HIDE_MS = 480;

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelPro2MediaGroupToolbarHide(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

export function schedulePro2MediaGroupToolbarHide(
  groupId: string,
  clear: () => void,
  delayMs = PRO2_MEDIA_GROUP_TOOLBAR_HIDE_MS,
): void {
  cancelPro2MediaGroupToolbarHide();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    clear();
  }, delayMs);
}

export function pinPro2MediaGroupToolbarHover(
  groupId: string,
  setHoveredMediaGroupId: (id: string | null) => void,
): void {
  cancelPro2MediaGroupToolbarHide();
  setHoveredMediaGroupId(groupId);
}
