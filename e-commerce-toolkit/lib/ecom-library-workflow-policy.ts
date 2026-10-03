/** 资产库「工作流」Tab：仅这些 bundle 类型展示，并支持一键复用 / 复制打开 */
export const ECOM_LIBRARY_REUSABLE_WORKFLOW_ENTRY_KINDS = new Set([
  "product-design",
  "storyboard",
  "seed-video",
]);

export function isReusableLibraryWorkflowEntryKind(kind: string): boolean {
  return ECOM_LIBRARY_REUSABLE_WORKFLOW_ENTRY_KINDS.has(kind);
}
