/**
 * AI 试衣自定义模特图片代理
 *
 * `AiFitCustomModel.imageDataUrl` 存的是 base64 Data URL（单张可达数 MB），
 * 直接放进资产库列表会把响应撑爆，因此列表只给本路由地址，图片按需解码输出。
 *
 * 仅本人可读；公开分享页按 `AI_SPACE_PIN_SOURCE_PUBLIC_SAFE` 跳过这类引用。
 */

import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const row = await prisma.aiFitCustomModel.findFirst({
    where: { id, userId: auth.actor.userId },
    select: { imageDataUrl: true, updatedAt: true },
  });
  if (!row) return NextResponse.json({ error: "模特不存在" }, { status: 404 });

  const m = DATA_URL_RE.exec(row.imageDataUrl.trim());
  if (!m) {
    return NextResponse.json({ error: "模特图片格式无法解析" }, { status: 422 });
  }

  const buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": m[1],
      "Content-Length": String(buf.byteLength),
      // 私有资产：只允许浏览器本地缓存，禁止 CDN / 代理留存
      "Cache-Control": "private, max-age=3600",
      "Last-Modified": row.updatedAt.toUTCString(),
    },
  });
}
