/** 漫剧列行 / 文案段任务 scope（存于 inputPayload.storyScope） */

export type CanvasTaskStoryScope = {
  rowKey?: string;
  mediaKind?: string;
  llmSection?: string;
};

export function extractStoryScopeFromInputPayload(
  inputPayload: unknown,
): CanvasTaskStoryScope | undefined {
  if (!inputPayload || typeof inputPayload !== "object") return undefined;
  const raw = (inputPayload as Record<string, unknown>).storyScope;
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const out: CanvasTaskStoryScope = {};
  if (typeof s.rowKey === "string") out.rowKey = s.rowKey;
  if (typeof s.mediaKind === "string") out.mediaKind = s.mediaKind;
  if (typeof s.llmSection === "string") out.llmSection = s.llmSection;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function storyScopeKey(scope?: CanvasTaskStoryScope): string {
  if (!scope) return "";
  return [scope.llmSection, scope.rowKey, scope.mediaKind]
    .filter(Boolean)
    .join(":");
}

/** 同一 nodeId 上两任务是否互斥（同 scope 或 legacy 无 scope） */
export function storyScopesConflict(
  requested?: CanvasTaskStoryScope,
  existing?: CanvasTaskStoryScope,
): boolean {
  const a = storyScopeKey(requested);
  const b = storyScopeKey(existing);
  if (!a && !b) return true;
  if (!a || !b) return true;
  return a === b;
}

/** Poll 重试 / Gateway 日志：优先 payload.clientPage，否则按 storyScope 推断专业版路径 */
export function resolveCanvasTaskClientPage(
  projectId: string,
  inputPayload: unknown,
): string {
  if (inputPayload && typeof inputPayload === "object") {
    const page = (inputPayload as Record<string, unknown>).clientPage;
    if (typeof page === "string" && page.trim()) return page.trim();
  }
  if (extractStoryScopeFromInputPayload(inputPayload)) {
    return `canvas/${projectId}/story-pro`;
  }
  return `canvas/${projectId}`;
}
