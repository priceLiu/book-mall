export function confirmDestructiveTwice(firstMessage: string, secondMessage: string): boolean {
  if (typeof window === "undefined") return false;
  if (!window.confirm(firstMessage)) return false;
  return window.confirm(secondMessage);
}

export const CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH =
  "【再次确认】删除后无法恢复。将同时尝试删除云端存储（OSS）中的对应文件，确定继续？";
