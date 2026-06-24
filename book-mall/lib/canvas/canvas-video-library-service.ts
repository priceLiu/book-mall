/**
 * 画布 · 我的视频库 CRUD（与 SSO tools 路由共用 ImageToVideoLibraryItem 表）
 */
import type { Prisma } from "@prisma/client";
import { persistCanvasKieResultToOss } from "@/lib/canvas/canvas-oss";
import { readOssEnv } from "@/lib/oss-client";
import { prismaErrorCode } from "@/lib/ai-fit-db-error";
import {
  isPrismaConnectionUnavailable,
  prismaConnectionUnavailableMessage,
} from "@/lib/db-unavailable";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { prisma } from "@/lib/prisma";
import {
  TOOL_LIBRARY_RETENTION_DAYS,
  TOOL_VIDEO_LIBRARY_DEFAULT_MAX,
} from "@/lib/tool-library-quota";
import { resolveTenantContextForUser } from "@/lib/tenant/context";
import {
  buildVisibleAssetWhere,
  type AssetAccessError,
} from "@/lib/tenant/asset-sharing-service";

const MAX_URL_LEN = 8192;
const MAX_PROMPT_LEN = 8000;
const LAB_MODES = new Set(["i2v", "t2v", "ref"]);

export class CanvasVideoLibraryError extends Error {
  constructor(
    public code:
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "LIBRARY_FULL"
      | "OSS_DELETE_FAILED"
      | "DB_UNAVAILABLE",
    message: string,
    public httpStatus = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CanvasVideoLibraryError";
  }
}

export type CanvasVideoLibraryItem = {
  id: string;
  videoUrl: string;
  prompt: string | null;
  mode: string;
  resolution: string;
  durationSec: number;
  seed: string | null;
  modelLabel: string | null;
  retainUntil: string;
  createdAt: string;
  visibility?: string;
  mine?: boolean;
  canToggle?: boolean;
};

export type CanvasVideoLibraryListResult = {
  space: "TEAM" | "PERSONAL";
  canManagePublic: boolean;
  items: CanvasVideoLibraryItem[];
  quota: { max: number; used: number };
};

function coerceHttpsAliyun(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "http:" && /\.aliyuncs\.com$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.href;
    }
    return u.href;
  } catch {
    return raw.trim();
  }
}

function takeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const coerced = coerceHttpsAliyun(raw);
  const t = coerced.trim();
  if (!t || t.length > MAX_URL_LEN) return null;
  if (!/^https:\/\//i.test(t)) return null;
  return t;
}

function retainUntilFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TOOL_LIBRARY_RETENTION_DAYS);
  return d;
}

function isManagedPublicOssUrl(url: string): boolean {
  const cfg = readOssEnv();
  if ("error" in cfg) return false;
  try {
    const u = new URL(url);
    if (!/^https:$/i.test(u.protocol)) return false;
    const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
    if (base && url.startsWith(`${base}/`)) return true;
    return u.hostname === `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
  } catch {
    return false;
  }
}

function mapRow(
  r: {
    id: string;
    videoUrl: string;
    prompt: string | null;
    mode: string;
    resolution: string;
    durationSec: number;
    seed: string | null;
    modelLabel: string | null;
    retainUntil: Date;
    createdAt: Date;
    visibility?: string;
    userId: string;
    ownerUserId: string | null;
  },
  viewerUserId: string,
  isTeam: boolean,
  canManagePublic: boolean,
): CanvasVideoLibraryItem {
  const mine = (r.ownerUserId ?? r.userId) === viewerUserId;
  return {
    id: r.id,
    videoUrl: r.videoUrl,
    prompt: r.prompt ?? null,
    mode: r.mode,
    resolution: r.resolution,
    durationSec: r.durationSec,
    seed: r.seed ?? null,
    modelLabel: r.modelLabel ?? null,
    retainUntil: r.retainUntil.toISOString(),
    createdAt: r.createdAt.toISOString(),
    visibility: r.visibility,
    mine,
    canToggle: isTeam && (mine || canManagePublic),
  };
}

export async function listCanvasVideoLibrary(
  userId: string,
): Promise<CanvasVideoLibraryListResult> {
  const ctx = await resolveTenantContextForUser(userId);
  const isTeam = ctx?.tenantType === "TEAM";
  const where: Prisma.ImageToVideoLibraryItemWhereInput =
    isTeam && ctx
      ? buildVisibleAssetWhere<Prisma.ImageToVideoLibraryItemWhereInput>(ctx)
      : { userId };
  const canManagePublic = ctx?.role === "OWNER" || ctx?.role === "ADMIN";

  try {
    const [rows, countAll] = await Promise.all([
      prisma.imageToVideoLibraryItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.max(TOOL_VIDEO_LIBRARY_DEFAULT_MAX * 4, 50),
      }),
      prisma.imageToVideoLibraryItem.count({ where }),
    ]);

    return {
      space: isTeam ? "TEAM" : "PERSONAL",
      canManagePublic,
      items: rows.map((r) => mapRow(r, userId, isTeam, canManagePublic)),
      quota: { max: TOOL_VIDEO_LIBRARY_DEFAULT_MAX, used: countAll },
    };
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      throw new CanvasVideoLibraryError(
        "DB_UNAVAILABLE",
        "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。",
        503,
      );
    }
    if (isPrismaConnectionUnavailable(e)) {
      throw new CanvasVideoLibraryError(
        "DB_UNAVAILABLE",
        prismaConnectionUnavailableMessage(e),
        503,
      );
    }
    throw e;
  }
}

export async function createCanvasVideoLibraryItem(
  userId: string,
  body: Record<string, unknown>,
): Promise<{ item: CanvasVideoLibraryItem; quota: { max: number; used: number } }> {
  const videoUrl = takeHttpsUrl(body.videoUrl);
  if (!videoUrl) {
    throw new CanvasVideoLibraryError(
      "INVALID_INPUT",
      "videoUrl 须为 https 公网 URL（单条最长 8192 字符）",
    );
  }

  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!LAB_MODES.has(modeRaw)) {
    throw new CanvasVideoLibraryError("INVALID_INPUT", "mode 须为 i2v、t2v 或 ref");
  }

  const resolution =
    typeof body.resolution === "string" && /^(720P|1080P)$/.test(body.resolution.trim())
      ? body.resolution.trim()
      : null;
  if (!resolution) {
    throw new CanvasVideoLibraryError("INVALID_INPUT", "resolution 须为 720P 或 1080P");
  }

  const durationRaw = body.durationSec;
  const durationSec =
    typeof durationRaw === "number" && Number.isFinite(durationRaw)
      ? Math.round(durationRaw)
      : typeof durationRaw === "string" && /^\d+$/.test(durationRaw.trim())
        ? Number.parseInt(durationRaw.trim(), 10)
        : NaN;
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 600) {
    throw new CanvasVideoLibraryError("INVALID_INPUT", "durationSec 无效");
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;
  const seedRaw = typeof body.seed === "string" ? body.seed.trim().slice(0, 64) : "";
  const seed = seedRaw.length > 0 ? seedRaw : null;
  const modelLabelRaw =
    typeof body.modelLabel === "string" ? body.modelLabel.trim().slice(0, 200) : "";
  const modelLabel = modelLabelRaw.length > 0 ? modelLabelRaw : null;

  const used = await prisma.imageToVideoLibraryItem.count({ where: { userId } });
  if (used >= TOOL_VIDEO_LIBRARY_DEFAULT_MAX) {
    throw new CanvasVideoLibraryError(
      "LIBRARY_FULL",
      `我的视频库已满（上限 ${TOOL_VIDEO_LIBRARY_DEFAULT_MAX} 条）。可删除旧条目后再保存。`,
      409,
      { max: TOOL_VIDEO_LIBRARY_DEFAULT_MAX, used },
    );
  }

  const ctx = await resolveTenantContextForUser(userId);
  const row = await prisma.imageToVideoLibraryItem.create({
    data: {
      userId,
      videoUrl,
      prompt,
      mode: modeRaw,
      resolution,
      durationSec,
      seed,
      modelLabel,
      retainUntil: retainUntilFromNow(),
      tenantId: ctx?.tenantId ?? null,
      ownerUserId: userId,
      visibility: "PRIVATE",
    },
  });

  return {
    item: {
      id: row.id,
      videoUrl: row.videoUrl,
      prompt: row.prompt ?? null,
      mode: row.mode,
      resolution: row.resolution,
      durationSec: row.durationSec,
      seed: row.seed ?? null,
      modelLabel: row.modelLabel ?? null,
      retainUntil: row.retainUntil.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
    quota: { max: TOOL_VIDEO_LIBRARY_DEFAULT_MAX, used: used + 1 },
  };
}

export async function persistCanvasVideoLibraryFromUrl(
  userId: string,
  body: Record<string, unknown>,
): Promise<{
  item: CanvasVideoLibraryItem;
  quota: { max: number; used: number };
  rehosted: boolean;
}> {
  const sourceUrl = takeHttpsUrl(body.sourceUrl ?? body.videoUrl);
  if (!sourceUrl) {
    throw new CanvasVideoLibraryError(
      "INVALID_INPUT",
      "sourceUrl 须为 https 公网视频地址",
    );
  }

  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!LAB_MODES.has(modeRaw)) {
    throw new CanvasVideoLibraryError("INVALID_INPUT", "mode 须为 i2v、t2v 或 ref");
  }

  const resolution =
    typeof body.resolution === "string" && /^(720P|1080P)$/.test(body.resolution.trim())
      ? body.resolution.trim()
      : "720P";

  const durationRaw = body.durationSec;
  const durationSec =
    typeof durationRaw === "number" && Number.isFinite(durationRaw)
      ? Math.round(durationRaw)
      : typeof durationRaw === "string" && /^\d+$/.test(durationRaw.trim())
        ? Number.parseInt(durationRaw.trim(), 10)
        : 5;
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 600) {
    throw new CanvasVideoLibraryError("INVALID_INPUT", "durationSec 无效");
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;
  const seedRaw = typeof body.seed === "string" ? body.seed.trim().slice(0, 64) : "";
  const seed = seedRaw.length > 0 ? seedRaw : null;
  const modelLabelRaw =
    typeof body.modelLabel === "string" ? body.modelLabel.trim().slice(0, 200) : "";
  const modelLabel = modelLabelRaw.length > 0 ? modelLabelRaw : null;

  let videoUrl: string;
  try {
    videoUrl = isManagedPublicOssUrl(sourceUrl)
      ? sourceUrl
      : await persistCanvasKieResultToOss({
          ephemeralUrl: sourceUrl,
          kind: "node-video",
          userId,
        });
  } catch (e) {
    throw new CanvasVideoLibraryError(
      "INVALID_INPUT",
      e instanceof Error ? e.message : "转存 OSS 失败",
      502,
    );
  }

  const result = await createCanvasVideoLibraryItem(userId, {
    videoUrl,
    mode: modeRaw,
    resolution,
    durationSec,
    prompt,
    seed,
    modelLabel,
  });

  return {
    ...result,
    rehosted: !isManagedPublicOssUrl(sourceUrl),
  };
}

export async function deleteCanvasVideoLibraryItem(
  userId: string,
  id: string,
): Promise<{ ok: true; ossDeleted: boolean }> {
  const ctx = await resolveTenantContextForUser(userId);
  const canManagePublic = ctx?.role === "OWNER" || ctx?.role === "ADMIN";
  const found = await prisma.imageToVideoLibraryItem.findUnique({
    where: { id },
    select: {
      id: true,
      videoUrl: true,
      userId: true,
      ownerUserId: true,
      tenantId: true,
      visibility: true,
    },
  });
  const mine = found && (found.ownerUserId ?? found.userId) === userId;
  const teamManageable =
    found &&
    ctx?.tenantType === "TEAM" &&
    found.tenantId === ctx.tenantId &&
    found.visibility === "TEAM_PUBLIC" &&
    canManagePublic;
  const row = found && (mine || teamManageable) ? found : null;
  if (!row) {
    throw new CanvasVideoLibraryError("NOT_FOUND", "不存在或无权删除", 404);
  }

  const oss = await deleteManagedOssObjectByUrl(row.videoUrl);
  if (!oss.ok) {
    throw new CanvasVideoLibraryError(
      "OSS_DELETE_FAILED",
      oss.error,
      502,
    );
  }

  await prisma.imageToVideoLibraryItem.delete({ where: { id: row.id } });
  return { ok: true, ossDeleted: oss.deleted };
}

export function isCanvasVideoLibraryError(err: unknown): err is CanvasVideoLibraryError {
  return err instanceof CanvasVideoLibraryError;
}

export type { AssetAccessError };
