import { NextResponse } from "next/server";
import { AiFitGarmentSlot } from "@prisma/client";
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

function parseSlot(raw: unknown): AiFitGarmentSlot | null {
  if (raw === "top" || raw === "TOP") return AiFitGarmentSlot.TOP;
  if (raw === "bottom" || raw === "BOTTOM") return AiFitGarmentSlot.BOTTOM;
  if (raw === "one_piece" || raw === "ONE_PIECE" || raw === "one")
    return AiFitGarmentSlot.ONE_PIECE;
  return null;
}

/** 保存用户上传的服装图（base64 Data URL） */
export async function POST(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const slot = parseSlot(body.slot);
  if (!slot) {
    return NextResponse.json(
      { error: "slot 须为 top | bottom | one_piece" },
      { status: 400 },
    );
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

  try {
    const row = await prisma.aiFitGarmentUpload.create({
      data: {
        userId: v.userId,
        slot,
        imageDataUrl: parsed.dataUrl,
      },
    });
    return NextResponse.json({
      id: row.id,
      slot: row.slot,
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
