/**
 * 分镜/视频行 · @ 参考图 URL 解析（漫剧 + 影视专业版共用）
 */

type StoryRefImageRow = { id: string; url?: string };

function parseMentionIds(prompt: string): string[] {
  const ids: string[] = [];
  const re = /@<([^>\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    ids.push(m[1]!);
  }
  return ids;
}

export { parseMentionIds };

export function resolveStoryRowRefUrls(
  row: Record<string, unknown>,
  promptField = "prompt",
): string[] {
  const prompt = String(row[promptField] ?? row.prompt ?? "");
  const refImages = row.refImages as StoryRefImageRow[] | undefined;
  if (refImages?.length) {
    const byId = new Map(
      refImages
        .filter((r) => r.url && /^https?:\/\//.test(String(r.url)))
        .map((r) => [r.id, String(r.url)]),
    );
    const fromMentions = parseMentionIds(prompt)
      .map((id) => byId.get(id))
      .filter((u): u is string => Boolean(u));
    if (fromMentions.length) return fromMentions.slice(0, 8);
    return Array.from(byId.values()).slice(0, 8);
  }
  const legacy = row.refImageUrls;
  if (Array.isArray(legacy)) {
    return legacy
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
      .slice(0, 8);
  }
  return [];
}
