import { NextResponse } from "next/server";
import {
  TOOL_LIBRARY_RETENTION_DAYS,
  TOOL_VIDEO_LIBRARY_DEFAULT_MAX,
} from "@/lib/tool-library-quota";
import { prismaErrorCode } from "@/lib/ai-fit-db-error";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_URL_LEN = 8192;
const MAX_PROMPT_LEN = 8000;
const LAB_MODES = new Set(["i2v", "t2v", "ref"]);

function verifyBearer(req: Request):
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse } {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 }),
    };
  }
  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return {
      ok: false,
      res: NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 }),
    };
  }
  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return {
      ok: false,
      res: NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 }),
    };
  }
  return { ok: true, userId: verified.sub };
}

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
  if (!t) return null;
  if (t.length > MAX_URL_LEN) return null;
  if (!/^https:\/\//i.test(t)) return null;
  return t;
}

function retainUntilFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TOOL_LIBRARY_RETENTION_DAYS);
  return d;
}

export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let rows: Awaited<ReturnType<typeof prisma.imageToVideoLibraryItem.findMany>>;
  let countAll: number;
  try {
    [rows, countAll] = await Promise.all([
      prisma.imageToVideoLibraryItem.findMany({
        where: { userId: v.userId },
        orderBy: { createdAt: "desc" },
        take: Math.max(TOOL_VIDEO_LIBRARY_DEFAULT_MAX * 4, 50),
      }),
      prisma.imageToVideoLibraryItem.count({ where: { userId: v.userId } }),
    ]);
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { items: [], error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    console.error("[image-to-video/library] GET list failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "读取视频库失败";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }

  return NextResponse.json({
    items: rows.map((r) => ({
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
    })),
    quota: { max: TOOL_VIDEO_LIBRARY_DEFAULT_MAX, used: countAll },
  });
}

export async function POST(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const videoUrl = takeHttpsUrl(body.videoUrl);
  if (!videoUrl) {
    return NextResponse.json(
      {
        error:
          "videoUrl 须为 https 公网 URL（单条最长 8192 字符）；阿里云 OSS 的 http 链会自动升为 https",
      },
      { status: 400 },
    );
  }

  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!LAB_MODES.has(modeRaw)) {
    return NextResponse.json(
      { error: "mode 须为 i2v、t2v 或 ref" },
      { status: 400 },
    );
  }

  const resolution =
    typeof body.resolution === "string" && /^(720P|1080P)$/.test(body.resolution.trim())
      ? body.resolution.trim()
      : null;
  if (!resolution) {
    return NextResponse.json({ error: "resolution 须为 720P 或 1080P" }, { status: 400 });
  }

  const durationRaw = body.durationSec;
  const durationSec =
    typeof durationRaw === "number" && Number.isFinite(durationRaw)
      ? Math.round(durationRaw)
      : typeof durationRaw === "string" && /^\d+$/.test(durationRaw.trim())
        ? Number.parseInt(durationRaw.trim(), 10)
        : NaN;
  if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 600) {
    return NextResponse.json({ error: "durationSec 无效" }, { status: 400 });
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;

  const seedRaw = typeof body.seed === "string" ? body.seed.trim().slice(0, 64) : "";
  const seed = seedRaw.length > 0 ? seedRaw : null;

  const modelLabelRaw =
    typeof body.modelLabel === "string" ? body.modelLabel.trim().slice(0, 200) : "";
  const modelLabel = modelLabelRaw.length > 0 ? modelLabelRaw : null;

  try {
    const used = await prisma.imageToVideoLibraryItem.count({
      where: { userId: v.userId },
    });
    if (used >= TOOL_VIDEO_LIBRARY_DEFAULT_MAX) {
      return NextResponse.json(
        {
          error: "video_library_full",
          message: `我的视频库已满（上限 ${TOOL_VIDEO_LIBRARY_DEFAULT_MAX} 条）。可删除旧条目或申请扩容（即将支持）。`,
          max: TOOL_VIDEO_LIBRARY_DEFAULT_MAX,
          used,
        },
        { status: 409 },
      );
    }

    const row = await prisma.imageToVideoLibraryItem.create({
      data: {
        userId: v.userId,
        videoUrl,
        prompt,
        mode: modeRaw,
        resolution,
        durationSec,
        seed,
        modelLabel,
        retainUntil: retainUntilFromNow(),
      },
    });

    return NextResponse.json({
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
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    console.error("[image-to-video/library] POST create failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "保存失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    const row = await prisma.imageToVideoLibraryItem.findFirst({
      where: { id, userId: v.userId },
      select: { id: true, videoUrl: true },
    });
    if (!row) {
      return NextResponse.json({ error: "不存在或无权删除" }, { status: 404 });
    }

    const oss = await deleteManagedOssObjectByUrl(row.videoUrl);
    if (!oss.ok) {
      return NextResponse.json({ error: oss.error }, { status: 502 });
    }

    await prisma.imageToVideoLibraryItem.delete({ where: { id: row.id } });
    return NextResponse.json({ ok: true, ossDeleted: oss.deleted });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    console.error("[image-to-video/library] DELETE failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "删除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
