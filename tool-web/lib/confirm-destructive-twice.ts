/**
 * 破坏性删除：须连续两次确认（见 .cursor/rules/destructive-delete-confirmation.mdc）。
 */
export function confirmDestructiveTwice(firstMessage: string, secondMessage: string): boolean {
  if (typeof window === "undefined") return false;
  if (!window.confirm(firstMessage)) return false;
  return window.confirm(secondMessage);
}

/** 第二次确认：涉及库记录 + OSS 对象删除的接口 */
export const CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH =
  "【再次确认】删除后无法恢复。将同时尝试删除云端存储（OSS）中的对应文件，确定继续？";

/** 第二次确认：仅库记录（当前后端未删 OSS 时仍统一二次确认） */
export const CONFIRM_DELETE_GENERIC_SECOND_ZH =
  "【再次确认】删除后无法恢复，确定继续？";
