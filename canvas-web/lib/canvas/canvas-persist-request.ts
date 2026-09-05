/** 请求画布 autosave 立即或 debounce 落盘（项目页监听 canvas:flush-autosave） */

export function requestCanvasGraphPersistFlush(options?: {
  immediate?: boolean;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("canvas:flush-autosave", {
      detail: { immediate: options?.immediate ?? false },
    }),
  );
}
