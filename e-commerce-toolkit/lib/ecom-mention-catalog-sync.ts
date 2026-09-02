import { buildFilmPullMentionCatalog } from "@/lib/film-pull-refs";
import type { FilmPullCharacterRef, FilmPullProductionShot } from "@/lib/film-pull-types";
import {
  listReplicaModelRefs,
  listReplicaProductRefs,
} from "@/lib/media-decompose-replica-refs";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/seed-video-types";

export type MentionCatalogEntry = {
  refId: string;
  token: string;
  index: number;
  role: "model" | "product";
};

const MENTION_TOKEN_RE = /@图片(\d+)/g;

export function buildMentionCatalogFromFilmPullRefs(
  characterRefs: FilmPullCharacterRef[],
): MentionCatalogEntry[] {
  return buildFilmPullMentionCatalog(characterRefs).map((entry) => ({
    refId: entry.ref.id,
    token: entry.token,
    index: entry.index,
    role: entry.role,
  }));
}

/** 拆图复刻 seedVideo.references → @图片N 目录 */
export function buildReplicaMentionCatalogEntries(
  references: SeedVideoReference[],
): MentionCatalogEntry[] {
  const entries: MentionCatalogEntry[] = [];
  let index = 1;
  for (const ref of listReplicaModelRefs(references)) {
    entries.push({ refId: ref.id, token: `@图片${index}`, index, role: "model" });
    index += 1;
  }
  for (const ref of listReplicaProductRefs(references)) {
    entries.push({ refId: ref.id, token: `@图片${index}`, index, role: "product" });
    index += 1;
  }
  return entries;
}

export function mentionCatalogSignature(catalog: MentionCatalogEntry[]): string {
  return catalog.map((e) => `${e.refId}:${e.token}`).join("|");
}

export function syncMentionText(
  text: string,
  oldCatalog: MentionCatalogEntry[],
  newCatalog: MentionCatalogEntry[],
): string {
  if (!text.trim()) return text;
  const newByRefId = new Map(newCatalog.map((e) => [e.refId, e]));
  let result = text;

  for (const entry of oldCatalog) {
    if (newByRefId.has(entry.refId)) continue;
    const sameSlotReplacement = newCatalog.find(
      (e) => e.token === entry.token && e.role === entry.role && e.index === entry.index,
    );
    if (sameSlotReplacement) continue;

    if (newCatalog.some((e) => e.token === entry.token)) {
      const idx = result.indexOf(entry.token);
      if (idx >= 0) {
        result = result.slice(0, idx) + result.slice(idx + entry.token.length);
      }
      continue;
    }
    result = result.split(entry.token).join("");
  }

  for (const entry of oldCatalog) {
    const next = newByRefId.get(entry.refId);
    if (next && next.token !== entry.token) {
      result = result.split(entry.token).join(next.token);
    }
  }

  return result.replace(/\s{2,}/g, " ").trim();
}

function roleEntries(catalog: MentionCatalogEntry[], role: "model" | "product"): MentionCatalogEntry[] {
  return catalog.filter((e) => e.role === role);
}

export function syncRefIdList(
  ids: string[],
  oldCatalog: MentionCatalogEntry[],
  newCatalog: MentionCatalogEntry[],
  role: "model" | "product",
): string[] {
  const valid = new Set(roleEntries(newCatalog, role).map((e) => e.refId));
  const oldRole = roleEntries(oldCatalog, role);
  const newRole = roleEntries(newCatalog, role);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const id of ids) {
    if (valid.has(id)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
      continue;
    }
    const slotIdx = oldRole.findIndex((e) => e.refId === id);
    const replacement = slotIdx >= 0 ? newRole[slotIdx] : newRole[0];
    if (replacement && !seen.has(replacement.refId)) {
      seen.add(replacement.refId);
      out.push(replacement.refId);
    }
  }
  return out;
}

export function syncFilmPullProductionShotsAfterRefChange(
  shots: FilmPullProductionShot[],
  oldCatalog: MentionCatalogEntry[],
  newCatalog: MentionCatalogEntry[],
): FilmPullProductionShot[] {
  if (mentionCatalogSignature(oldCatalog) === mentionCatalogSignature(newCatalog)) {
    return shots;
  }
  return shots.map((shot) => ({
    ...shot,
    imagePrompt: syncMentionText(shot.imagePrompt ?? "", oldCatalog, newCatalog),
    videoPrompt: syncMentionText(shot.videoPrompt ?? "", oldCatalog, newCatalog),
    modelRefIds: syncRefIdList(shot.modelRefIds ?? [], oldCatalog, newCatalog, "model"),
    productRefIds: syncRefIdList(shot.productRefIds ?? [], oldCatalog, newCatalog, "product"),
  }));
}

export function syncSeedVideoShotsAfterRefChange(
  shots: SeedVideoShot[],
  oldCatalog: MentionCatalogEntry[],
  newCatalog: MentionCatalogEntry[],
): SeedVideoShot[] {
  if (mentionCatalogSignature(oldCatalog) === mentionCatalogSignature(newCatalog)) {
    return shots;
  }
  const validIds = new Set(newCatalog.map((e) => e.refId));
  return shots.map((shot) => {
    let refImageId = shot.refImageId;
    let refImageLabel = shot.refImageLabel;
    if (refImageId && !validIds.has(refImageId)) {
      const oldEntry = oldCatalog.find((e) => e.refId === refImageId);
      if (oldEntry) {
        const oldRole = roleEntries(oldCatalog, oldEntry.role);
        const newRole = roleEntries(newCatalog, oldEntry.role);
        const slotIdx = oldRole.findIndex((e) => e.refId === refImageId);
        const replacement = slotIdx >= 0 ? newRole[slotIdx] : newRole[0];
        if (replacement) {
          refImageId = replacement.refId;
          refImageLabel = replacement.token;
        } else {
          refImageId = "";
          refImageLabel = "";
        }
      }
    } else if (refImageId) {
      const entry = newCatalog.find((e) => e.refId === refImageId);
      if (entry) refImageLabel = entry.token;
    }
    return {
      ...shot,
      refImageId,
      refImageLabel,
      videoPrompt: syncMentionText(shot.videoPrompt ?? "", oldCatalog, newCatalog),
    };
  });
}

/** 清理 Prompt 中已失效的 @图片N（目录中不存在的序号） */
export function stripOrphanMentionTokens(text: string, catalog: MentionCatalogEntry[]): string {
  const valid = new Set(catalog.map((e) => e.index));
  return text.replace(MENTION_TOKEN_RE, (match, num) =>
    valid.has(Number(num)) ? match : "",
  ).replace(/\s{2,}/g, " ").trim();
}
