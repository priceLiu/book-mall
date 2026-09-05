import { NextResponse } from "next/server";

import {
  assertHandCraftComposeImageUrl,
  fetchHandCraftComposeImageBuffer,
} from "@/lib/ecom/ecom-hand-craft-image-proxy";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 拼版离屏 DOM 经同域代理加载 OSS 成图，避免 html2canvas CORS 抓成灰块 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url).searchParams.get("url")?.trim();
  if (!url) {
    return NextResponse.json({ error: "缺少 url" }, { status: 400 });
  }

  try {
    assertHandCraftComposeImageUrl(url, auth.userId);
    const { buf, contentType } = await fetchHandCraftComposeImageBuffer(url);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取失败";
    const status =
      message === "INVALID_OSS_URL" ||
      message === "FORBIDDEN_OSS_URL" ||
      message === "FORBIDDEN_OSS_HOST"
        ? 403
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
