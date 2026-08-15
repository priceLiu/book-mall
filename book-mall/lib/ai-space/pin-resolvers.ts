/**
 * 我的 AI 空间 · Pin 读时 resolve
 *
 * 每个 sourceType 一个批量 resolver：入参一组 sourceId，返回展示字段。
 * 源记录不存在时不返回该条（删源已 cascade 删 Pin，理论上不应出现）。
 */

import { prisma } from "@/lib/prisma";
import {
  AI_SPACE_PIN_SOURCE_LABEL,
  type AiSpacePinEntry,
  type AiSpacePinSourceType,
  type WorkflowLaunchSpec,
} from "./ai-space-pin-types";

type Resolved = AiSpacePinEntry["resolved"];

/** sourceId → 展示字段 */
type ResolvedMap = Map<string, Resolved>;

type ResolverFn = (args: {
  userId: string;
  sourceIds: string[];
}) => Promise<ResolvedMap>;

function ecomLaunch(module: string): WorkflowLaunchSpec {
  return {
    app: "ecom",
    // 电商资产库为统一入口；具体模块的复用在库内点「继续创作」完成
    path: "/library",
    mode: "open_studio",
    query: { module },
  };
}

const resolveEcomAsset: ResolverFn = async ({ userId, sourceIds }) => {
  const rows = await prisma.ecomAsset.findMany({
    where: { id: { in: sourceIds }, userId },
    select: {
      id: true,
      module: true,
      kind: true,
      title: true,
      prompt: true,
      ossUrl: true,
      thumbnailUrl: true,
      createdAt: true,
    },
  });
  const map: ResolvedMap = new Map();
  for (const r of rows) {
    map.set(r.id, {
      kind: r.kind === "video" ? "video" : "image",
      title: r.title ?? null,
      prompt: r.prompt ?? null,
      mediaUrl: r.ossUrl,
      thumbnailUrl: r.thumbnailUrl ?? (r.kind === "video" ? null : r.ossUrl),
      createdAt: r.createdAt.toISOString(),
      durationSec: null,
      moduleLabel: r.module,
      launch: ecomLaunch(r.module),
    });
  }
  return map;
};

const resolveT2iLibrary: ResolverFn = async ({ userId, sourceIds }) => {
  const rows = await prisma.textToImageLibraryItem.findMany({
    where: { id: { in: sourceIds }, userId },
    select: {
      id: true,
      imageUrl: true,
      prompt: true,
      createdAt: true,
    },
  });
  const map: ResolvedMap = new Map();
  for (const r of rows) {
    map.set(r.id, {
      kind: "image",
      title: null,
      prompt: r.prompt ?? null,
      mediaUrl: r.imageUrl,
      thumbnailUrl: r.imageUrl,
      createdAt: r.createdAt.toISOString(),
      durationSec: null,
      moduleLabel: AI_SPACE_PIN_SOURCE_LABEL.t2i_library,
      launch: {
        app: "tools",
        path: "/text-to-image/library",
        mode: "open_studio",
      },
    });
  }
  return map;
};

const resolveI2vLibrary: ResolverFn = async ({ userId, sourceIds }) => {
  const rows = await prisma.imageToVideoLibraryItem.findMany({
    where: { id: { in: sourceIds }, userId },
    select: {
      id: true,
      videoUrl: true,
      prompt: true,
      mode: true,
      durationSec: true,
      modelLabel: true,
      createdAt: true,
    },
  });
  const map: ResolvedMap = new Map();
  for (const r of rows) {
    map.set(r.id, {
      kind: "video",
      title: r.modelLabel ?? null,
      prompt: r.prompt ?? null,
      mediaUrl: r.videoUrl,
      thumbnailUrl: null,
      createdAt: r.createdAt.toISOString(),
      durationSec: r.durationSec,
      moduleLabel: r.mode,
      launch: {
        app: "tools",
        path: "/image-to-video/library",
        mode: "open_studio",
      },
    });
  }
  return map;
};

const resolveAiSpaceAudio: ResolverFn = async ({ userId, sourceIds }) => {
  const rows = await prisma.aiSpaceAudioAsset.findMany({
    where: { id: { in: sourceIds }, userId },
    select: {
      id: true,
      name: true,
      audioUrl: true,
      textScript: true,
      durationSec: true,
      sourceType: true,
      createdAt: true,
    },
  });
  const map: ResolvedMap = new Map();
  for (const r of rows) {
    map.set(r.id, {
      kind: "audio",
      title: r.name,
      prompt: r.textScript ?? null,
      mediaUrl: r.audioUrl,
      thumbnailUrl: null,
      createdAt: r.createdAt.toISOString(),
      durationSec: r.durationSec,
      moduleLabel: r.sourceType,
      launch: null,
    });
  }
  return map;
};

const resolveAiSpaceVideo: ResolverFn = async ({ userId, sourceIds }) => {
  const rows = await prisma.aiSpaceVideoMaterial.findMany({
    where: { id: { in: sourceIds }, userId },
    select: {
      id: true,
      name: true,
      videoUrl: true,
      durationSec: true,
      category: true,
      createdAt: true,
    },
  });
  const map: ResolvedMap = new Map();
  for (const r of rows) {
    map.set(r.id, {
      kind: "video",
      title: r.name,
      prompt: null,
      mediaUrl: r.videoUrl,
      thumbnailUrl: null,
      createdAt: r.createdAt.toISOString(),
      durationSec: r.durationSec,
      moduleLabel: r.category,
      launch: null,
    });
  }
  return map;
};

const resolveAiSpaceDigitalHuman: ResolverFn = async ({ userId, sourceIds }) => {
  const rows = await prisma.aiSpaceDigitalHuman.findMany({
    where: { id: { in: sourceIds }, userId },
    select: {
      id: true,
      name: true,
      avatarImageUrl: true,
      status: true,
      createdAt: true,
    },
  });
  const map: ResolvedMap = new Map();
  for (const r of rows) {
    map.set(r.id, {
      kind: "image",
      title: r.name,
      prompt: null,
      mediaUrl: r.avatarImageUrl,
      thumbnailUrl: r.avatarImageUrl,
      createdAt: r.createdAt.toISOString(),
      durationSec: null,
      moduleLabel: r.status,
      launch: null,
    });
  }
  return map;
};

const RESOLVERS: Record<AiSpacePinSourceType, ResolverFn> = {
  ecom_asset: resolveEcomAsset,
  t2i_library: resolveT2iLibrary,
  i2v_library: resolveI2vLibrary,
  ai_space_audio: resolveAiSpaceAudio,
  ai_space_video: resolveAiSpaceVideo,
  ai_space_digital_human: resolveAiSpaceDigitalHuman,
};

/** 批量 resolve：按 sourceType 分组并行查询 */
export async function resolvePinSources(
  userId: string,
  refs: { sourceType: AiSpacePinSourceType; sourceId: string }[],
): Promise<Map<string, Resolved>> {
  const byType = new Map<AiSpacePinSourceType, string[]>();
  for (const ref of refs) {
    const list = byType.get(ref.sourceType);
    if (list) list.push(ref.sourceId);
    else byType.set(ref.sourceType, [ref.sourceId]);
  }

  const results = await Promise.all(
    [...byType.entries()].map(async ([sourceType, sourceIds]) => {
      const map = await RESOLVERS[sourceType]({ userId, sourceIds });
      return [sourceType, map] as const;
    }),
  );

  /** key = `${sourceType}:${sourceId}` */
  const merged = new Map<string, Resolved>();
  for (const [sourceType, map] of results) {
    for (const [sourceId, resolved] of map) {
      merged.set(`${sourceType}:${sourceId}`, resolved);
    }
  }
  return merged;
}

/** 校验源记录存在且归属该用户（createPin 前置检查） */
export async function assertPinSourceOwned(
  userId: string,
  sourceType: AiSpacePinSourceType,
  sourceId: string,
): Promise<boolean> {
  const map = await RESOLVERS[sourceType]({ userId, sourceIds: [sourceId] });
  return map.has(sourceId);
}
