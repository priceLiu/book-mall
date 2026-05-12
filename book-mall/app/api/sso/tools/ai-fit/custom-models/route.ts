import { NextResponse } from "next/server";
import {
  AI_FIT_TABLES_MISSING_MESSAGE,
  prismaErrorCode,
} from "@/lib/ai-fit-db-error";
import { parseFitImageDataUrl } from "@/lib/ai-fit-image";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

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

/** 列出当前用户的自定义模特（新创建的在前） */
export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let rows;
  try {
    rows = await prisma.aiFitCustomModel.findMany({
      where: { userId: v.userId },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    const code = prismaErrorCode(e);
    if (code === "P2021") {
      return NextResponse.json(
        { models: [], error: AI_FIT_TABLES_MISSING_MESSAGE },
        { status: 503 },
      );
    }
    throw e;
  }

  const models = rows.map((r) => ({
    id: r.id,
    name: r.name,
    style: r.style.length > 0 ? r.style : "—",
    height: r.height.length > 0 ? r.height : "—",
    weight: r.weight.length > 0 ? r.weight : "—",
    body: r.body.length > 0 ? r.body : "—",
    bust: r.bust ?? undefined,
    waist: r.waist ?? undefined,
    hips: r.hips ?? undefined,
    imageDataUrl: r.imageDataUrl,
    isCustom: true,
  }));

  return NextResponse.json({ models });
}

/** 新建自定义模特 */
export async function POST(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    return NextResponse.json({ error: "name 必填" }, { status: 400 });
  }

  const imageRaw =
    typeof body.imageDataUrl === "string"
      ? body.imageDataUrl
      : typeof body.base64 === "string"
        ? body.base64
        : "";
  const parsed = parseFitImageDataUrl(imageRaw);
  if (!parsed.ok) {
    const map: Record<string, string> = {
      empty: "图片不能为空",
      invalid_data_url: "图片须为 JPG/PNG/WebP 的 Data URL 或合法 base64",
      unsupported_mime: "仅支持 JPG、PNG、WebP",
      invalid_base64: "base64 无效",
      too_large: "图片过大（单张不超过 6MB）",
    };
    return NextResponse.json(
      { error: map[parsed.error] ?? "图片无效" },
      { status: 400 },
    );
  }

  const str = (k: string, max = 80) =>
    typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "";

  try {
    const row = await prisma.aiFitCustomModel.create({
      data: {
        userId: v.userId,
        name,
        style: str("style", 120),
        height: str("height", 40),
        weight: str("weight", 40),
        body: str("body", 120),
        bust: str("bust", 40) || null,
        waist: str("waist", 40) || null,
        hips: str("hips", 40) || null,
        imageDataUrl: parsed.dataUrl,
      },
    });

    return NextResponse.json({
      model: {
        id: row.id,
        name: row.name,
        style: row.style.length > 0 ? row.style : "—",
        height: row.height.length > 0 ? row.height : "—",
        weight: row.weight.length > 0 ? row.weight : "—",
        body: row.body.length > 0 ? row.body : "—",
        bust: row.bust ?? undefined,
        waist: row.waist ?? undefined,
        hips: row.hips ?? undefined,
        imageDataUrl: row.imageDataUrl,
        isCustom: true,
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
    throw e;
  }
}
