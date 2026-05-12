import { NextResponse } from "next/server";
import { AiFitClosetGarmentMode } from "@prisma/client";
import {
  AI_FIT_TABLES_MISSING_MESSAGE,
  prismaErrorCode,
} from "@/lib/ai-fit-db-error";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

const MAX_URL_LEN = 8192;
const MAX_NOTE_LEN = 120;

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

function parseGarmentMode(raw: unknown): AiFitClosetGarmentMode | null {
  if (raw === "two_piece" || raw === "TWO_PIECE") return AiFitClosetGarmentMode.TWO_PIECE;
  if (raw === "one_piece" || raw === "ONE_PIECE") return AiFitClosetGarmentMode.ONE_PIECE;
  return null;
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

/** 列出当前用户「我的衣柜」（按创建时间倒序） */
export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let rows;
  try {
    rows = await prisma.aiFitClosetItem.findMany({
      where: { userId: v.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { items: [], error: AI_FIT_TABLES_MISSING_MESSAGE },
        { status: 503 },
      );
    }
    console.error("[ai-fit/closet] GET list failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "读取衣柜失败";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      imageUrl: r.imageUrl,
      garmentMode: r.garmentMode === "TWO_PIECE" ? "two_piece" : "one_piece",
      personImageUrl: r.personImageUrl ?? null,
      topGarmentUrl: r.topGarmentUrl ?? null,
      bottomGarmentUrl: r.bottomGarmentUrl ?? null,
      note: r.note ?? null,
      taskId: r.taskId ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/** 保存一张试衣成片到衣柜 */
export async function POST(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const imageUrl = takeHttpsUrl(body.imageUrl);
  if (!imageUrl) {
    return NextResponse.json(
      { error: "imageUrl 须为 https 公网 URL（单条最长 8192 字符）；阿里云 OSS 的 http 链会自动升为 https" },
      { status: 400 },
    );
  }

  const mode = parseGarmentMode(body.garmentMode);
  if (!mode) {
    return NextResponse.json(
      { error: "garmentMode 须为 two_piece 或 one_piece" },
      { status: 400 },
    );
  }

  const note =
    typeof body.note === "string"
      ? body.note.trim().slice(0, MAX_NOTE_LEN) || null
      : null;
  const taskId =
    typeof body.taskId === "string"
      ? body.taskId.trim().slice(0, 120) || null
      : null;
  const personImageUrl = takeHttpsUrl(body.personImageUrl);
  const topGarmentUrl = takeHttpsUrl(body.topGarmentUrl);
  const bottomGarmentUrl = takeHttpsUrl(body.bottomGarmentUrl);

  try {
    const row = await prisma.aiFitClosetItem.create({
      data: {
        userId: v.userId,
        imageUrl,
        garmentMode: mode,
        personImageUrl,
        topGarmentUrl,
        bottomGarmentUrl,
        note,
        taskId,
      },
    });
    return NextResponse.json({
      item: {
        id: row.id,
        imageUrl: row.imageUrl,
        garmentMode: row.garmentMode === "TWO_PIECE" ? "two_piece" : "one_piece",
        personImageUrl: row.personImageUrl ?? null,
        topGarmentUrl: row.topGarmentUrl ?? null,
        bottomGarmentUrl: row.bottomGarmentUrl ?? null,
        note: row.note ?? null,
        taskId: row.taskId ?? null,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { error: AI_FIT_TABLES_MISSING_MESSAGE },
        { status: 503 },
      );
    }
    if (code === "P2003") {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    console.error("[ai-fit/closet] POST create failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "保存失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 删除一条衣柜记录（仅限本人） */
export async function DELETE(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    const r = await prisma.aiFitClosetItem.deleteMany({
      where: { id, userId: v.userId },
    });
    if (r.count === 0) {
      return NextResponse.json({ error: "不存在或无权删除" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { error: AI_FIT_TABLES_MISSING_MESSAGE },
        { status: 503 },
      );
    }
    console.error("[ai-fit/closet] DELETE failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "删除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
