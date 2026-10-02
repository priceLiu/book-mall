import { NextResponse } from "next/server";
import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  assertBrandViComposeImageUrl,
  fetchBrandViComposeImageBuffer,
} from "@/lib/ecom/ecom-brand-vi-image-proxy";
import {
  fetchEcomVendorImageBuffer,
  isEcomVendorPreviewImageUrl,
} from "@/lib/ecom/ecom-vendor-image-download";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 拼版离屏 DOM 经同域代理加载 OSS 成图，避免 html2canvas CORS 抓成灰块 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url).searchParams.get("url")?.trim();
  if (!url) {
    return ecomJson({ error: "缺少 url" }, { status: 400 });
  }

  try {
    let buf: Buffer;
    let contentType = "image/png";
    try {
      assertBrandViComposeImageUrl(url, auth.userId);
      const fetched = await fetchBrandViComposeImageBuffer(url);
      buf = fetched.buf;
      contentType = fetched.contentType;
    } catch {
      if (!isEcomVendorPreviewImageUrl(url)) {
        throw new Error("FORBIDDEN_OSS_URL");
      }
      buf = await fetchEcomVendorImageBuffer(url);
    }
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
    return ecomJson({ error: message }, { status });
  }
}
