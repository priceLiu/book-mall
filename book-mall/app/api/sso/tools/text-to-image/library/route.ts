import { NextResponse } from "next/server";
import { prismaErrorCode } from "@/lib/ai-fit-db-error";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

const MAX_URL_LEN = 8192;
const MAX_PROMPT_LEN = 2000;

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

export async function GET() {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let rows;
  try {
    rows = await prisma.textToImageLibraryItem.findMany({
      where: { userId: v.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { items: [], error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    console.error("[text-to-image/library] GET list failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "读取图片库失败";
    return NextResponse.json({ items: [], error: msg }, { status: 500 });
  }

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      imageUrl: r.imageUrl,
      prompt: r.prompt ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/** 保存一张文生图成片到图片库 */
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
      {
        error:
          "imageUrl 须为 https 公网 URL（单条最长 8192 字符）；阿里云 OSS 的 http 链会自动升为 https",
      },
      { status: 400 },
    );
  }

  const promptRaw =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : "";
  const prompt = promptRaw.length > 0 ? promptRaw : null;

  try {
    const row = await prisma.textToImageLibraryItem.create({
      data: {
        userId: v.userId,
        imageUrl,
        prompt,
      },
    });
    return NextResponse.json({
      item: {
        id: row.id,
        imageUrl: row.imageUrl,
        prompt: row.prompt ?? null,
        createdAt: row.createdAt.toISOString(),
      },
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
    console.error("[text-to-image/library] POST create failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "保存失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 删除一条记录（仅限本人） */
export async function DELETE(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    const r = await prisma.textToImageLibraryItem.deleteMany({
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
        { error: "数据库尚未迁移，请联系管理员执行 prisma migrate deploy。" },
        { status: 503 },
      );
    }
    console.error("[text-to-image/library] DELETE failed", e);
    const msg =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "删除失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
