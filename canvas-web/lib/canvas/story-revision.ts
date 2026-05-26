/** 故事工作流文本快照（随 CanvasProject.canvas 自动入库，每槽最多 3 条） */

export const STORY_REVISION_MAX = 3;

export type StoryTextRevision = {
  savedAt: string;
  content: string;
};

export function pushStoryRevision(
  history: StoryTextRevision[] | undefined,
  content: string,
): StoryTextRevision[] {
  const trimmed = content.trim();
  if (!trimmed) return history ?? [];
  const prev = history ?? [];
  if (prev[0]?.content === trimmed) return prev;
  const next: StoryTextRevision[] = [
    { savedAt: new Date().toISOString(), content: trimmed },
    ...prev,
  ];
  return next.slice(0, STORY_REVISION_MAX);
}

export function formatRevisionTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
