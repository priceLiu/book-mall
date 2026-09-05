import type { SeedVideoReference } from "@/lib/ecom/ecom-seed-video-types";

const LEGACY_REF_RE = /@图片(\d+)/g;

/** 从 user 消息提取 @图片N 序号（1-based） */
export function parseMentionedImageIndices(text: string): number[] {
  const indices = new Set<number>();
  for (const m of text.matchAll(LEGACY_REF_RE)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) indices.add(n);
  }
  return [...indices].sort((a, b) => a - b);
}

/** Vision 送图：按 @图片N 顺序；若无 @ 则送全部素材（上限 max） */
export function resolveSeedVideoChatImageUrls(
  references: SeedVideoReference[],
  userText: string,
  max: number,
): string[] {
  const materials = references.filter((r) => r.role === "seed-material");
  const mentioned = parseMentionedImageIndices(userText);
  if (mentioned.length > 0) {
    const urls: string[] = [];
    for (const n of mentioned) {
      const ref = materials[n - 1];
      if (ref?.ossUrl) urls.push(ref.ossUrl);
    }
    return urls.slice(0, max);
  }
  return materials.slice(0, max).map((r) => r.ossUrl);
}

/** 解析 user 消息引用的 ref id（用于气泡缩略图） */
export function resolveMentionedRefIds(
  references: SeedVideoReference[],
  userText: string,
): string[] {
  const materials = references.filter((r) => r.role === "seed-material");
  const mentioned = parseMentionedImageIndices(userText);
  if (mentioned.length > 0) {
    return mentioned
      .map((n) => materials[n - 1]?.id)
      .filter((id): id is string => Boolean(id));
  }
  return materials.map((r) => r.id);
}

export function seedMaterialUploadLimit(): number {
  return 9;
}
