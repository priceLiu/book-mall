/**
 * 全局资产库 · 源适配器注册表（唯一真源）
 *
 * 一个资产源 = 一条 `SOURCE_ADAPTERS` 条目。每条同时服务两种读法：
 * - **按 id 解析**（Pin 卡片、画布块引用）→ `resolvePinSources`
 * - **按最近列举**（资产库聚合浏览，无需先收藏）→ `listSourceAssets`
 *
 * 两种读法共用同一段 `where` 与同一个行→展示字段映射，避免出现第二套解析器。
 * 约束见 .cursor/rules/ai-space-space-blocks.mdc 与 doc/product/AI 空间功能设计文档.md §11。
 */

import { resolveGenerationRecordPreview } from "@/lib/canvas/generation-record-preview";
import { prisma } from "@/lib/prisma";
import {
  AI_SPACE_PIN_SOURCE_LABEL,
  type AiSpacePinEntry,
  type AiSpacePinMediaKind,
  type AiSpacePinSourceType,
  type WorkflowLaunchSpec,
} from "./ai-space-pin-types";

type Resolved = AiSpacePinEntry["resolved"];

/** sourceId → 展示字段 */
type ResolvedMap = Map<string, Resolved>;

export type SourceAssetRow = { sourceId: string; resolved: Resolved };

type SourceFetchArgs = {
  userId: string;
  /** 精确取这些 id；与 limit 二选一 */
  ids?: string[];
  /** 聚合浏览：取最近 N 条 */
  limit?: number;
  /** 关键词，命中字段由各源自行决定 */
  keyword?: string | null;
};

type SourceAdapter = {
  /** 该源可能产出的形态；按形态筛选时可整源跳过，省一次查询 */
  kinds: AiSpacePinMediaKind[];
  fetch(args: SourceFetchArgs): Promise<SourceAssetRow[]>;
};

/** 列举模式下的单源上限；按 id 取时不限（调用方已按块 refs 上限约束） */
const DEFAULT_LIST_LIMIT = 40;
const MAX_LIST_LIMIT = 100;

function takeFor(args: SourceFetchArgs): number | undefined {
  if (args.ids) return undefined;
  return Math.min(Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
}

function idFilter(args: SourceFetchArgs): { id: { in: string[] } } | Record<string, never> {
  return args.ids ? { id: { in: args.ids } } : {};
}

function keywordOf(args: SourceFetchArgs): string | null {
  // 按 id 精确取时忽略关键词：块引用不应因搜索词而解析失败
  if (args.ids) return null;
  const v = args.keyword?.trim();
  return v ? v.slice(0, 60) : null;
}

/** 关键词 OR 片段；无关键词时返回空对象 */
function contains(
  keyword: string | null,
  fields: string[],
): { OR: Record<string, { contains: string; mode: "insensitive" }>[] } | Record<string, never> {
  if (!keyword) return {};
  return {
    OR: fields.map((f) => ({ [f]: { contains: keyword, mode: "insensitive" as const } })),
  };
}

// ---------------------------------------------------------------------------
// 电商工具箱 / AI 工具站
// ---------------------------------------------------------------------------

function ecomLaunch(module: string): WorkflowLaunchSpec {
  return {
    app: "ecom",
    // 电商资产库为统一入口；具体模块的复用在库内点「继续创作」完成
    path: "/library",
    mode: "open_studio",
    query: { module },
  };
}

const ecomAssetAdapter: SourceAdapter = {
  kinds: ["image", "video"],
  async fetch(args) {
    const rows = await prisma.ecomAsset.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["title", "prompt"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
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
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: r.kind === "video" ? "video" : "image",
        title: r.title ?? null,
        prompt: r.prompt ?? null,
        mediaUrl: r.ossUrl,
        thumbnailUrl: r.thumbnailUrl ?? (r.kind === "video" ? null : r.ossUrl),
        createdAt: r.createdAt.toISOString(),
        durationSec: null,
        moduleLabel: r.module,
        launch: ecomLaunch(r.module),
      },
    }));
  },
};

const t2iLibraryAdapter: SourceAdapter = {
  kinds: ["image"],
  async fetch(args) {
    const rows = await prisma.textToImageLibraryItem.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["prompt"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: { id: true, imageUrl: true, prompt: true, createdAt: true },
    });
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "image",
        title: null,
        prompt: r.prompt ?? null,
        mediaUrl: r.imageUrl,
        thumbnailUrl: r.imageUrl,
        createdAt: r.createdAt.toISOString(),
        durationSec: null,
        moduleLabel: AI_SPACE_PIN_SOURCE_LABEL.t2i_library,
        launch: { app: "tools", path: "/text-to-image/library", mode: "open_studio" },
      },
    }));
  },
};

const i2vLibraryAdapter: SourceAdapter = {
  kinds: ["video"],
  async fetch(args) {
    const rows = await prisma.imageToVideoLibraryItem.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["prompt", "modelLabel"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
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
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "video",
        title: r.modelLabel ?? null,
        prompt: r.prompt ?? null,
        mediaUrl: r.videoUrl,
        thumbnailUrl: null,
        createdAt: r.createdAt.toISOString(),
        durationSec: r.durationSec,
        moduleLabel: r.mode,
        launch: { app: "tools", path: "/image-to-video/library", mode: "open_studio" },
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// AI 空间自有库（Book 真源）
// ---------------------------------------------------------------------------

const aiSpaceAudioAdapter: SourceAdapter = {
  kinds: ["audio"],
  async fetch(args) {
    const rows = await prisma.aiSpaceAudioAsset.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["name", "textScript"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
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
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "audio",
        title: r.name,
        prompt: r.textScript ?? null,
        mediaUrl: r.audioUrl,
        thumbnailUrl: null,
        createdAt: r.createdAt.toISOString(),
        durationSec: r.durationSec,
        moduleLabel: r.sourceType,
        launch: null,
      },
    }));
  },
};

const aiSpaceVideoAdapter: SourceAdapter = {
  kinds: ["video"],
  async fetch(args) {
    const rows = await prisma.aiSpaceVideoMaterial.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["name"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        name: true,
        videoUrl: true,
        durationSec: true,
        category: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "video",
        title: r.name,
        prompt: null,
        mediaUrl: r.videoUrl,
        thumbnailUrl: null,
        createdAt: r.createdAt.toISOString(),
        durationSec: r.durationSec,
        moduleLabel: r.category,
        launch: null,
      },
    }));
  },
};

const aiSpaceDigitalHumanAdapter: SourceAdapter = {
  kinds: ["image"],
  async fetch(args) {
    const rows = await prisma.aiSpaceDigitalHuman.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["name"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        name: true,
        avatarImageUrl: true,
        status: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "image",
        title: r.name,
        prompt: null,
        mediaUrl: r.avatarImageUrl,
        thumbnailUrl: r.avatarImageUrl,
        createdAt: r.createdAt.toISOString(),
        durationSec: null,
        moduleLabel: r.status,
        launch: null,
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// 影视项目（story-web）：角色头像、分镜图、分镜视频
//
// 归属经 project.userId 判定；软删项目不参与。
// ---------------------------------------------------------------------------

function storyLaunch(projectId: string): WorkflowLaunchSpec {
  return {
    app: "story",
    path: `/project/${projectId}`,
    mode: "open_project",
    projectId,
  };
}

const storyCharacterAdapter: SourceAdapter = {
  kinds: ["image"],
  async fetch(args) {
    const rows = await prisma.storyCharacter.findMany({
      where: {
        avatarUrl: { not: "" },
        project: { userId: args.userId, deletedAt: null },
        ...idFilter(args),
        ...contains(keywordOf(args), ["name", "role"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        name: true,
        role: true,
        imagePrompt: true,
        avatarUrl: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "image",
        title: r.name,
        prompt: r.imagePrompt || null,
        mediaUrl: r.avatarUrl,
        thumbnailUrl: r.avatarUrl,
        createdAt: r.createdAt.toISOString(),
        durationSec: null,
        moduleLabel: r.role || r.project.name,
        launch: storyLaunch(r.project.id),
      },
    }));
  },
};

/** 分镜图与分镜视频同一张表，按取哪个 URL 分成两种 sourceType */
function makeStoryFrameAdapter(media: "image" | "video"): SourceAdapter {
  const isVideo = media === "video";
  return {
    kinds: [isVideo ? "video" : "image"],
    async fetch(args) {
      const rows = await prisma.storyStoryboardFrame.findMany({
        where: {
          ...(isVideo ? { videoUrl: { not: "" } } : { imageUrl: { not: "" } }),
          project: { userId: args.userId, deletedAt: null },
          ...idFilter(args),
          ...contains(keywordOf(args), ["sceneText", "sceneDescription"]),
        },
        orderBy: { createdAt: "desc" },
        take: takeFor(args),
        select: {
          id: true,
          index: true,
          sceneText: true,
          imageUrl: true,
          videoUrl: true,
          imagePrompt: true,
          videoPrompt: true,
          createdAt: true,
          project: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        sourceId: r.id,
        resolved: {
          kind: isVideo ? ("video" as const) : ("image" as const),
          title: `${r.project.name} · 第 ${r.index} 镜`,
          prompt: (isVideo ? r.videoPrompt : r.imagePrompt) || r.sceneText || null,
          mediaUrl: isVideo ? r.videoUrl : r.imageUrl,
          // 分镜视频用同镜分镜图当封面
          thumbnailUrl: isVideo ? r.imageUrl || null : r.imageUrl,
          createdAt: r.createdAt.toISOString(),
          durationSec: null,
          moduleLabel: r.sceneText || null,
          launch: storyLaunch(r.project.id),
        },
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// 统一项目资产与画布产物（canvas-web · Pro2 / sbv1 / Story-Pro）
// ---------------------------------------------------------------------------

/** ProjectAssetKind → 展示形态 */
function projectAssetKindToMedia(kind: string): AiSpacePinMediaKind {
  if (kind === "AUDIO") return "audio";
  if (kind === "STORYBOARD_VIDEO") return "video";
  return "image";
}

const PROJECT_ASSET_KIND_LABEL: Record<string, string> = {
  CHARACTER: "角色",
  SCENE: "场景",
  PROP: "道具",
  AUDIO: "音频",
  STORYBOARD_IMAGE: "分镜图",
  STORYBOARD_VIDEO: "分镜视频",
  DIGITAL_HUMAN: "数字人",
  PRIVATE_PORTRAIT: "私人形象",
  STYLE: "风格",
  GROUP_BUNDLE: "组合",
};

/** 纯文字资产（大纲 / 脚本 / 提示词）没有媒体，资产库不展示 */
const PROJECT_ASSET_TEXT_KINDS = [
  "OUTLINE",
  "STORYBOARD_SCRIPT",
  "PROMPT",
  "SCRIPT_PACKAGE",
] as const;

const projectAssetAdapter: SourceAdapter = {
  kinds: ["image", "video", "audio"],
  async fetch(args) {
    const rows = await prisma.projectAsset.findMany({
      where: {
        ownerUserId: args.userId,
        deletedAt: null,
        ...(args.ids
          ? { id: { in: args.ids } }
          : { kind: { notIn: [...PROJECT_ASSET_TEXT_KINDS] } }),
        ...contains(keywordOf(args), ["displayName", "description"]),
      },
      orderBy: { updatedAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        kind: true,
        displayName: true,
        description: true,
        thumbnailUrl: true,
        createdAt: true,
        refs: {
          select: { mediaUrl: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    });
    const out: SourceAssetRow[] = [];
    for (const r of rows) {
      const primary = r.refs[0]?.mediaUrl ?? "";
      const mediaUrl = primary || r.thumbnailUrl;
      if (!mediaUrl) continue;
      out.push({
        sourceId: r.id,
        resolved: {
          kind: projectAssetKindToMedia(r.kind),
          title: r.displayName,
          prompt: r.description || null,
          mediaUrl,
          thumbnailUrl: r.thumbnailUrl || (primary ? null : mediaUrl),
          createdAt: r.createdAt.toISOString(),
          durationSec: null,
          moduleLabel: PROJECT_ASSET_KIND_LABEL[r.kind] ?? r.kind,
          launch: { app: "canvas", path: "/assets", mode: "open_studio" },
        },
      });
    }
    return out;
  },
};

const canvasTaskAdapter: SourceAdapter = {
  kinds: ["image", "video"],
  async fetch(args) {
    const rows = await prisma.canvasGenerationTask.findMany({
      where: {
        status: "SUCCEEDED",
        deletedAt: null,
        // 只收已落 OSS 的产物：厂商 ephemeral 链接会过期
        ossUrl: { not: null },
        ...idFilter(args),
        // 归属与关键词都用 OR，必须并列在 AND 下，否则后者覆盖前者
        AND: [
          // 任务可能由协作成员发起：本人发起或本人项目均视为可引用
          { OR: [{ actorUserId: args.userId }, { project: { userId: args.userId } }] },
          contains(keywordOf(args), ["archivePromptText", "model"]),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        model: true,
        ossUrl: true,
        ephemeralUrl: true,
        inputPayload: true,
        archivePromptText: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    });
    const out: SourceAssetRow[] = [];
    for (const r of rows) {
      if (!r.ossUrl) continue;
      const preview = resolveGenerationRecordPreview({
        ossUrl: r.ossUrl,
        ephemeralUrl: r.ephemeralUrl,
        inputPayload: r.inputPayload,
      });
      const isVideo = preview.previewKind === "video";
      out.push({
        sourceId: r.id,
        resolved: {
          kind: isVideo ? "video" : "image",
          title: r.project.name,
          prompt: r.archivePromptText ?? null,
          mediaUrl: r.ossUrl,
          thumbnailUrl: isVideo ? preview.thumbnailUrl : r.ossUrl,
          createdAt: r.createdAt.toISOString(),
          durationSec: null,
          moduleLabel: r.model,
          launch: {
            app: "canvas",
            path: `/canvas/${r.project.id}`,
            mode: "open_project",
            projectId: r.project.id,
          },
        },
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// AI 试衣（tool-web）
// ---------------------------------------------------------------------------

const AI_FIT_LAUNCH: WorkflowLaunchSpec = {
  app: "tools",
  path: "/fitting-room/ai-fit",
  mode: "open_studio",
};

/**
 * 自定义模特存的是 base64 Data URL（单张可达数 MB），不能塞进列表响应。
 * 统一走鉴权代理路由输出图片；公开页按 `AI_SPACE_PIN_SOURCE_PUBLIC_SAFE` 跳过。
 */
export function aiFitModelImageHref(id: string): string {
  return `/api/platform/v1/ai-space/assets/aifit-model/${id}/image`;
}

const aiFitModelAdapter: SourceAdapter = {
  kinds: ["image"],
  async fetch(args) {
    const rows = await prisma.aiFitCustomModel.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["name", "style"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      // 刻意不 select imageDataUrl：base64 只由代理路由单条读取
      select: {
        id: true,
        name: true,
        style: true,
        height: true,
        body: true,
        createdAt: true,
      },
    });
    return rows.map((r) => {
      const href = aiFitModelImageHref(r.id);
      return {
        sourceId: r.id,
        resolved: {
          kind: "image" as const,
          title: r.name,
          prompt: [r.style, r.height, r.body].filter(Boolean).join(" · ") || null,
          mediaUrl: href,
          thumbnailUrl: href,
          createdAt: r.createdAt.toISOString(),
          durationSec: null,
          moduleLabel: AI_SPACE_PIN_SOURCE_LABEL.aifit_model,
          launch: AI_FIT_LAUNCH,
        },
      };
    });
  },
};

const aiFitClosetAdapter: SourceAdapter = {
  kinds: ["image"],
  async fetch(args) {
    const rows = await prisma.aiFitClosetItem.findMany({
      where: {
        userId: args.userId,
        ...idFilter(args),
        ...contains(keywordOf(args), ["note"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        imageUrl: true,
        garmentMode: true,
        note: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      sourceId: r.id,
      resolved: {
        kind: "image" as const,
        title: r.note ?? null,
        prompt: null,
        mediaUrl: r.imageUrl,
        thumbnailUrl: r.imageUrl,
        createdAt: r.createdAt.toISOString(),
        durationSec: null,
        moduleLabel: r.garmentMode === "ONE_PIECE" ? "连衣" : "上下装",
        launch: AI_FIT_LAUNCH,
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// 快速复制（quick-replica-web）
// ---------------------------------------------------------------------------

/** 模板产出可能是图或视频，按常见键名找第一个 http 地址 */
function readQrTemplateOutput(
  raw: unknown,
): { mediaUrl: string; kind: AiSpacePinMediaKind } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const video = typeof o.videoUrl === "string" ? o.videoUrl : "";
  if (video.startsWith("http")) return { mediaUrl: video, kind: "video" };
  for (const key of ["mediaUrl", "imageUrl", "ossUrl", "url"]) {
    const v = o[key];
    if (typeof v === "string" && v.startsWith("http")) {
      return { mediaUrl: v, kind: "image" };
    }
  }
  return null;
}

const qrTemplateAdapter: SourceAdapter = {
  kinds: ["image", "video"],
  async fetch(args) {
    const rows = await prisma.qrTemplate.findMany({
      where: {
        ownerUserId: args.userId,
        // 平台运营维护的公开模板不是用户作品
        isPlatformCatalog: false,
        deletedAt: null,
        ...idFilter(args),
        ...contains(keywordOf(args), ["title"]),
      },
      orderBy: { createdAt: "desc" },
      take: takeFor(args),
      select: {
        id: true,
        title: true,
        kind: true,
        category: true,
        thumbnailUrl: true,
        output: true,
        createdAt: true,
      },
    });
    const out: SourceAssetRow[] = [];
    for (const r of rows) {
      const parsed = readQrTemplateOutput(r.output);
      const mediaUrl = parsed?.mediaUrl ?? r.thumbnailUrl;
      if (!mediaUrl.startsWith("http")) continue;
      out.push({
        sourceId: r.id,
        resolved: {
          kind: parsed?.kind ?? "image",
          title: r.title,
          prompt: null,
          mediaUrl,
          thumbnailUrl: r.thumbnailUrl || (parsed?.kind === "video" ? null : mediaUrl),
          createdAt: r.createdAt.toISOString(),
          durationSec: null,
          moduleLabel: r.kind || r.category,
          launch: { app: "quick-replica", path: "/", mode: "open_studio" },
        },
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// 注册表
// ---------------------------------------------------------------------------

export const SOURCE_ADAPTERS: Record<AiSpacePinSourceType, SourceAdapter> = {
  ecom_asset: ecomAssetAdapter,
  t2i_library: t2iLibraryAdapter,
  i2v_library: i2vLibraryAdapter,
  ai_space_audio: aiSpaceAudioAdapter,
  ai_space_video: aiSpaceVideoAdapter,
  ai_space_digital_human: aiSpaceDigitalHumanAdapter,
  story_character: storyCharacterAdapter,
  story_frame_image: makeStoryFrameAdapter("image"),
  story_frame_video: makeStoryFrameAdapter("video"),
  project_asset: projectAssetAdapter,
  canvas_task: canvasTaskAdapter,
  aifit_model: aiFitModelAdapter,
  aifit_closet: aiFitClosetAdapter,
  qr_template: qrTemplateAdapter,
};

/** 该源可能产出的形态；资产库按形态筛选时用来整源跳过 */
export function sourceMediaKinds(
  sourceType: AiSpacePinSourceType,
): AiSpacePinMediaKind[] {
  return SOURCE_ADAPTERS[sourceType].kinds;
}

/** 聚合浏览：列举某个源最近的资产（不要求已收进空间） */
export async function listSourceAssets(args: {
  userId: string;
  sourceType: AiSpacePinSourceType;
  limit?: number;
  keyword?: string | null;
}): Promise<SourceAssetRow[]> {
  return SOURCE_ADAPTERS[args.sourceType].fetch({
    userId: args.userId,
    limit: args.limit,
    keyword: args.keyword ?? null,
  });
}

/** 批量 resolve：按 sourceType 分组并行查询 */
export async function resolvePinSources(
  userId: string,
  refs: { sourceType: AiSpacePinSourceType; sourceId: string }[],
): Promise<Map<string, Resolved>> {
  const byType = new Map<AiSpacePinSourceType, string[]>();
  for (const ref of refs) {
    // 回滚到旧版本时库里可能残留新版才有的 sourceType，跳过而非抛错
    if (!SOURCE_ADAPTERS[ref.sourceType]) continue;
    const list = byType.get(ref.sourceType);
    if (list) list.push(ref.sourceId);
    else byType.set(ref.sourceType, [ref.sourceId]);
  }

  const results = await Promise.all(
    [...byType.entries()].map(async ([sourceType, sourceIds]) => {
      const rows = await SOURCE_ADAPTERS[sourceType].fetch({ userId, ids: sourceIds });
      const map: ResolvedMap = new Map();
      for (const row of rows) map.set(row.sourceId, row.resolved);
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
  const rows = await SOURCE_ADAPTERS[sourceType].fetch({
    userId,
    ids: [sourceId],
  });
  return rows.some((r) => r.sourceId === sourceId);
}
