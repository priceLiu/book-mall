/** Radix Dialog 偶发未清理 body 锁定，会导致全页点击失效（含侧栏导航） */
export function unlockEcomDocumentInteraction() {
  if (typeof document === "undefined") return;
  document.body.style.removeProperty("pointer-events");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
  document.body.removeAttribute("data-scroll-locked");
  document.documentElement.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("padding-right");
}
