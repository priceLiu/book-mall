/**
 * 分镜视频 · @ 参考图 URL 解析（资产库 / 角色列 runtime 优先，行内 refImages 仅兜底）
 */
import type { StoryProCharacterAssetRefKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  listStoryProCharacterAssets,
  normalizeStoryProCharacterKey,
  type StoryProCharacterAssetRecord,
  type StoryProCharacterAssetRefRecord,
} from "./story-pro-character-asset-service";
import { listStoryProSceneAssets } from "./story-pro-scene-asset-service";
import { resolveStoryRowRefUrls } from "./story-row-ref-urls";

const THREE_VIEW_KIND: StoryProCharacterAssetRefKind = "three_view";

function parseMentionIds(prompt: string): string[] {
  const ids: string[] = [];
  const re = /@<([^>\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    ids.push(m[1]!);
  }
  return ids;
}

function parsePrefixedAssetRefId(
  prefix: string,
  id: string,
): { assetId: string; refId: string } | null {
  if (!id.startsWith(prefix)) return null;
  const rest = id.slice(prefix.length);
  const lastDash = rest.lastIndexOf("-");
  if (lastDash <= 0) return null;
  return { assetId: rest.slice(0, lastDash), refId: rest.slice(lastDash + 1) };
}

type CharAsset = Awaited<
  ReturnType<typeof listStoryProCharacterAssets>
>[number];
type SceneAsset = Awaited<ReturnType<typeof listStoryProSceneAssets>>[number];

function latestRefForKind(
  refs: StoryProCharacterAssetRefRecord[],
  kind: StoryProCharacterAssetRefKind,
): StoryProCharacterAssetRefRecord | undefined {
  const matches = refs.filter((r) => r.kind === kind);
  if (!matches.length) return undefined;
  return matches.sort((a, b) => b.sortOrder - a.sortOrder)[0];
}

function pickCharAssetForKey(
  charAssets: StoryProCharacterAssetRecord[],
  characterKey: string,
  projectId: string | null,
): StoryProCharacterAssetRecord | undefined {
  const k = normalizeStoryProCharacterKey(characterKey);
  const matches = charAssets.filter(
    (a) => normalizeStoryProCharacterKey(a.characterKey) === k,
  );
  if (!matches.length) return undefined;
  const candidates = matches.filter(
    (a) => a.projectId === projectId || !a.projectId,
  );
  const pool = candidates.length ? candidates : matches;
  return [...pool].sort((a, b) => {
    const aScoped = a.projectId === projectId ? 1 : 0;
    const bScoped = b.projectId === projectId ? 1 : 0;
    if (bScoped !== aScoped) return bScoped - aScoped;
    return b.refs.length - a.refs.length;
  })[0];
}

function refUrl(ref: { ossUrl?: string } | undefined): string | null {
  const u = ref?.ossUrl?.trim();
  return u && /^https?:\/\//.test(u) ? u : null;
}

function resolveLatestThreeViewUrl(
  asset: StoryProCharacterAssetRecord | undefined,
): string | null {
  if (!asset?.refs.length) return null;
  return refUrl(latestRefForKind(asset.refs, THREE_VIEW_KIND));
}

/** 角色列 runtime · 三视图（重新生成后行内 refImages 可能仍是旧 URL） */
async function loadCanvasCharacterThreeViews(
  userId: string,
  projectId: string | null | undefined,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pid = projectId?.trim();
  if (!pid) return out;

  const project = await prisma.canvasProject.findFirst({
    where: { id: pid, userId, deletedAt: null },
    select: { canvas: true },
  });
  if (!project?.canvas || typeof project.canvas !== "object") return out;

  const canvas = project.canvas as {
    nodes?: Array<{
      type?: string;
      data?: {
        rows?: Array<{
          key?: string;
          runtime?: { ossUrl?: string; ephemeralUrl?: string };
        }>;
      };
    }>;
  };

  for (const node of canvas.nodes ?? []) {
    if (
      node.type !== "story-character-column" &&
      node.type !== "story-pro-character"
    ) {
      continue;
    }
    for (const row of node.data?.rows ?? []) {
      const key = normalizeStoryProCharacterKey(String(row.key ?? ""));
      if (!key) continue;
      const u =
        row.runtime?.ossUrl?.trim() || row.runtime?.ephemeralUrl?.trim();
      if (u && /^https?:\/\//.test(u)) out.set(key, u);
    }
  }
  return out;
}

function resolveMentionUrlFromAssets(
  id: string,
  charAssets: CharAsset[],
  sceneAssets: SceneAsset[],
  refImagesById: Map<string, string>,
  projectId: string | null,
  canvasThreeViews: Map<string, string>,
): string | null {
  if (id.startsWith("ref-char-")) {
    const key = id.slice("ref-char-".length);
    const normKey = normalizeStoryProCharacterKey(key);
    const asset = pickCharAssetForKey(charAssets, key, projectId);
    const fromAsset = resolveLatestThreeViewUrl(asset);
    if (fromAsset) return fromAsset;
    const fromCanvas = canvasThreeViews.get(normKey);
    if (fromCanvas) return fromCanvas;
    const fromRow = refImagesById.get(id);
    return fromRow && /^https?:\/\//.test(fromRow) ? fromRow : null;
  }

  const charRef = parsePrefixedAssetRefId("ref-asset-", id);
  if (charRef) {
    const asset = charAssets.find((a) => a.id === charRef.assetId);
    const ref = asset?.refs.find((r) => r.id === charRef.refId);
    if (ref?.kind === THREE_VIEW_KIND) {
      const latest = resolveLatestThreeViewUrl(asset);
      if (latest) return latest;
    }
    const u = refUrl(ref);
    if (u) return u;
    const fromRow = refImagesById.get(id);
    return fromRow && /^https?:\/\//.test(fromRow) ? fromRow : null;
  }

  const sceneRef = parsePrefixedAssetRefId("ref-scene-asset-", id);
  if (sceneRef) {
    const asset = sceneAssets.find((a) => a.id === sceneRef.assetId);
    const ref = asset?.refs.find((r) => r.id === sceneRef.refId);
    const u = refUrl(ref);
    if (u) return u;
    const fromRow = refImagesById.get(id);
    return fromRow && /^https?:\/\//.test(fromRow) ? fromRow : null;
  }

  const fromRow = refImagesById.get(id);
  return fromRow && /^https?:\/\//.test(fromRow) ? fromRow : null;
}

/** 按 videoPrompt 中 @ 顺序解析参考图 URL（最多 8 张） */
export async function resolveStoryProVideoRefUrls(
  userId: string,
  projectId: string | null | undefined,
  row: Record<string, unknown>,
  promptField = "videoPrompt",
): Promise<string[]> {
  const prompt = String(row[promptField] ?? row.prompt ?? "");
  const mentionIds = parseMentionIds(prompt);
  const fromRow = resolveStoryRowRefUrls(row, promptField);

  const refImages = (row.refImages ?? []) as { id: string; url?: string }[];
  const refImagesById = new Map(
    refImages
      .filter((r) => r.url && /^https?:\/\//.test(String(r.url)))
      .map((r) => [r.id, String(r.url)]),
  );

  if (!mentionIds.length) return fromRow.slice(0, 8);

  const projectIdNorm = projectId?.trim() || null;
  const needsCanvasFallback = mentionIds.some((id) => id.startsWith("ref-char-"));

  const [charAssets, sceneAssets, canvasThreeViews] = await Promise.all([
    listStoryProCharacterAssets(userId, { projectId }),
    listStoryProSceneAssets(userId, { projectId }),
    needsCanvasFallback
      ? loadCanvasCharacterThreeViews(userId, projectId)
      : Promise.resolve(new Map<string, string>()),
  ]);

  const urls: string[] = [];
  const seen = new Set<string>();
  for (const id of mentionIds) {
    const u = resolveMentionUrlFromAssets(
      id,
      charAssets,
      sceneAssets,
      refImagesById,
      projectIdNorm,
      canvasThreeViews,
    );
    if (!u || !/^https?:\/\//.test(u) || seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }

  if (urls.length) return urls.slice(0, 8);
  return fromRow.slice(0, 8);
}
