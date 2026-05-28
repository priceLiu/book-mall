/**
 * 服务端 · 人物行 locked refs → imageInputs（P-A3）
 */

import type { StoryProCharacterAssetRefKind } from "@prisma/client";

import {
  listStoryProCharacterAssets,
  normalizeStoryProCharacterKey,
} from "./story-pro-character-asset-service";

const THREE_VIEW_KIND: StoryProCharacterAssetRefKind = "three_view";

export async function resolveCharacterRowAssetRefUrls(
  userId: string,
  projectId: string | null | undefined,
  row: { key?: string; lockedRefIds?: string[] },
  opts?: { excludeThreeView?: boolean },
): Promise<string[]> {
  const characterKey = normalizeStoryProCharacterKey(String(row.key ?? ""));
  if (!characterKey) return [];

  const assets = await listStoryProCharacterAssets(userId, { projectId });
  const asset = assets.find(
    (a) =>
      normalizeStoryProCharacterKey(a.characterKey) === characterKey &&
      (a.projectId === (projectId?.trim() || null) || !a.projectId),
  );
  if (!asset?.refs.length) return [];

  let refs = [...asset.refs];
  if (row.lockedRefIds?.length) {
    const locked = new Set(row.lockedRefIds);
    refs = refs.filter((r) => locked.has(r.id));
  }
  if (opts?.excludeThreeView !== false) {
    refs = refs.filter((r) => r.kind !== THREE_VIEW_KIND);
  }
  const urls: string[] = [];
  for (const r of refs) {
    const u = r.ossUrl.trim();
    if (/^https?:\/\//.test(u) && !urls.includes(u)) urls.push(u);
  }
  return urls.slice(0, 7);
}
