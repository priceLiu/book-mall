/**
 * 分镜视频 · @ 参考图 URL 解析（行内 refImages + 资产库兜底）
 */
import {
  listStoryProCharacterAssets,
  normalizeStoryProCharacterKey,
} from "./story-pro-character-asset-service";
import { listStoryProSceneAssets } from "./story-pro-scene-asset-service";
import { resolveStoryRowRefUrls } from "./story-row-ref-urls";

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

function resolveMentionUrlFromAssets(
  id: string,
  charAssets: CharAsset[],
  sceneAssets: SceneAsset[],
  refImagesById: Map<string, string>,
): string | null {
  const fromRow = refImagesById.get(id);
  if (fromRow && /^https?:\/\//.test(fromRow)) return fromRow;

  if (id.startsWith("ref-char-")) {
    const key = normalizeStoryProCharacterKey(id.slice("ref-char-".length));
    const asset = charAssets.find(
      (a) => normalizeStoryProCharacterKey(a.characterKey) === key,
    );
    const threeView = asset?.refs.find((r) => r.kind === "three_view");
    const u = threeView?.ossUrl?.trim();
    return u && /^https?:\/\//.test(u) ? u : null;
  }

  const charRef = parsePrefixedAssetRefId("ref-asset-", id);
  if (charRef) {
    const asset = charAssets.find((a) => a.id === charRef.assetId);
    const ref = asset?.refs.find((r) => r.id === charRef.refId);
    const u = ref?.ossUrl?.trim();
    return u && /^https?:\/\//.test(u) ? u : null;
  }

  const sceneRef = parsePrefixedAssetRefId("ref-scene-asset-", id);
  if (sceneRef) {
    const asset = sceneAssets.find((a) => a.id === sceneRef.assetId);
    const ref = asset?.refs.find((r) => r.id === sceneRef.refId);
    const u = ref?.ossUrl?.trim();
    return u && /^https?:\/\//.test(u) ? u : null;
  }

  return null;
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

  const allInRow = mentionIds.every((id) => {
    const u = refImagesById.get(id);
    return Boolean(u && /^https?:\/\//.test(u));
  });
  if (allInRow && fromRow.length >= mentionIds.length) {
    return fromRow.slice(0, 8);
  }

  const [charAssets, sceneAssets] = await Promise.all([
    listStoryProCharacterAssets(userId, { projectId }),
    listStoryProSceneAssets(userId, { projectId }),
  ]);

  const urls: string[] = [];
  const seen = new Set<string>();
  for (const id of mentionIds) {
    const u = resolveMentionUrlFromAssets(
      id,
      charAssets,
      sceneAssets,
      refImagesById,
    );
    if (!u || !/^https?:\/\//.test(u) || seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }

  if (urls.length) return urls.slice(0, 8);
  return fromRow.slice(0, 8);
}
