import type { ProjectAssetKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { listStoryProCharacterAssets } from "@/lib/canvas/story-pro-character-asset-service";
import { listStoryProSceneAssets } from "@/lib/canvas/story-pro-scene-asset-service";
import { listStoryProStyleProfiles } from "@/lib/canvas/story-pro-style-profile-service";
import { listStoryProCharacterAudioAssets } from "@/lib/canvas/story-pro-audio-asset-service";
import type { ProjectAssetRecord } from "./project-asset-types";

export type LegacyListOpts = {
  userId: string;
  projectId?: string | null;
  kind?: ProjectAssetKind | null;
};

function kindAllowed(filter: ProjectAssetKind | null | undefined, kind: ProjectAssetKind): boolean {
  return !filter || filter === kind;
}

export async function listLegacyProjectAssets(
  opts: LegacyListOpts,
): Promise<ProjectAssetRecord[]> {
  const { userId, projectId } = opts;
  const out: ProjectAssetRecord[] = [];

  if (kindAllowed(opts.kind, "CHARACTER")) {
    const chars = await listStoryProCharacterAssets(userId, { projectId });
    for (const c of chars) {
      const thumb = c.refs.find((r) => r.kind === "three_view")?.ossUrl ?? c.refs[0]?.ossUrl ?? "";
      out.push({
        id: `legacy:character:${c.id}`,
        tenantId: null,
        ownerUserId: userId,
        visibility: "PRIVATE",
        kind: "CHARACTER",
        displayName: c.displayName,
        description: "",
        thumbnailUrl: thumb,
        sourceProjectId: c.projectId,
        sourceNodeId: null,
        sourceEdition: "pro",
        locked: c.locked,
        editLockUserId: null,
        editLockExpiresAt: null,
        version: c.version,
        payload: {
          legacyId: c.id,
          legacySource: "storyProCharacter",
          characterKey: c.characterKey,
          slots: Object.fromEntries(c.refs.map((r) => [r.kind, r.ossUrl])),
        },
        refs: c.refs.map((r, i) => ({
          id: r.id,
          slotKey: r.kind,
          label: r.label ?? "",
          mediaUrl: r.ossUrl,
          mimeType: null,
          meta: r.sourceTaskId ? { sourceTaskId: r.sourceTaskId } : null,
          sortOrder: r.sortOrder ?? i,
        })),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        legacySource: "storyProCharacter",
      });
    }
  }

  if (kindAllowed(opts.kind, "SCENE") || kindAllowed(opts.kind, "PROP")) {
    const scenes = await listStoryProSceneAssets(userId, { projectId });
    for (const s of scenes) {
      const kind: ProjectAssetKind =
        s.sceneKey.includes("prop") || s.displayName.includes("道具")
          ? "PROP"
          : "SCENE";
      if (opts.kind && opts.kind !== kind) continue;
      const thumb = s.refs[0]?.ossUrl ?? "";
      out.push({
        id: `legacy:scene:${s.id}`,
        tenantId: null,
        ownerUserId: userId,
        visibility: "PRIVATE",
        kind,
        displayName: s.displayName,
        description: "",
        thumbnailUrl: thumb,
        sourceProjectId: s.projectId,
        sourceNodeId: null,
        sourceEdition: "pro",
        locked: s.locked,
        editLockUserId: null,
        editLockExpiresAt: null,
        version: s.version,
        payload: {
          legacyId: s.id,
          legacySource: "storyProScene",
          entityKey: s.sceneKey,
        },
        refs: s.refs.map((r, i) => ({
          id: r.id,
          slotKey: r.kind,
          label: r.label ?? "",
          mediaUrl: r.ossUrl,
          mimeType: null,
          meta: null,
          sortOrder: r.sortOrder ?? i,
        })),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        legacySource: "storyProScene",
      });
    }
  }

  if (kindAllowed(opts.kind, "STYLE")) {
    const profiles = await listStoryProStyleProfiles(userId, { projectId });
    for (const p of profiles) {
      const refUrls = Array.isArray(p.refImageUrls)
        ? (p.refImageUrls as string[])
        : [];
      out.push({
        id: `legacy:style:${p.id}`,
        tenantId: null,
        ownerUserId: userId,
        visibility: "PRIVATE",
        kind: "STYLE",
        displayName: p.displayName,
        description: p.anchorZh ?? "",
        thumbnailUrl: refUrls[0] ?? "",
        sourceProjectId: p.projectId,
        sourceNodeId: null,
        sourceEdition: "pro",
        locked: p.locked,
        editLockUserId: null,
        editLockExpiresAt: null,
        version: p.version,
        payload: {
          legacyId: p.id,
          legacySource: "storyProStyle",
          anchorText: p.anchorZh,
          refUrls,
          options: {
            mainStyle: p.mainStyle,
            colorTone: p.colorTone,
            renderQuality: p.renderQuality,
          },
        },
        refs: refUrls.map((url, i) => ({
          id: `${p.id}-ref-${i}`,
          slotKey: `ref_${i}`,
          label: "",
          mediaUrl: url,
          mimeType: null,
          meta: null,
          sortOrder: i,
        })),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        legacySource: "storyProStyle",
      });
    }
  }

  if (kindAllowed(opts.kind, "AUDIO")) {
    const audio = await listStoryProCharacterAudioAssets(userId, { projectId });
    for (const a of audio) {
      out.push({
        id: `legacy:audio:${a.id}`,
        tenantId: null,
        ownerUserId: userId,
        visibility: "PRIVATE",
        kind: "AUDIO",
        displayName: a.displayName,
        description: a.notes ?? "",
        thumbnailUrl: "",
        sourceProjectId: a.projectId,
        sourceNodeId: null,
        sourceEdition: "pro",
        locked: a.locked,
        editLockUserId: null,
        editLockExpiresAt: null,
        version: a.version,
        payload: {
          legacyId: a.id,
          legacySource: "storyProAudio",
          characterKey: a.characterKey,
          voiceLabel: a.voiceLabel,
          voiceId: a.voiceId,
        },
        refs: a.sampleOssUrl
          ? [
              {
                id: `${a.id}-sample`,
                slotKey: "sample",
                label: a.voiceLabel ?? "",
                mediaUrl: a.sampleOssUrl,
                mimeType: "audio/*",
                meta: null,
                sortOrder: 0,
              },
            ]
          : [],
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        legacySource: "storyProAudio",
      });
    }
  }

  // CanvasCharacter → simplified CHARACTER entries
  if (kindAllowed(opts.kind, "CHARACTER")) {
    const chars = await prisma.canvasCharacter.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    for (const c of chars) {
      out.push({
        id: `legacy:canvas-char:${c.id}`,
        tenantId: null,
        ownerUserId: userId,
        visibility: "PRIVATE",
        kind: "CHARACTER",
        displayName: c.name,
        description: "",
        thumbnailUrl: c.imageUrl,
        sourceProjectId: c.sourceProjectId,
        sourceNodeId: null,
        sourceEdition: "standard",
        locked: false,
        editLockUserId: null,
        editLockExpiresAt: null,
        version: 1,
        payload: {
          legacyId: c.id,
          legacySource: "canvasCharacter",
        },
        refs: [
          {
            id: `${c.id}-img`,
            slotKey: "three_view",
            label: "",
            mediaUrl: c.imageUrl,
            mimeType: null,
            meta: null,
            sortOrder: 0,
          },
        ],
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        legacySource: "canvasCharacter",
      });
    }
  }

  return out;
}
