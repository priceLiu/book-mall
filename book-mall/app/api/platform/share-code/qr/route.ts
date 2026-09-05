import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import QRCode from "qrcode";

import { resolveBookMallOrigin } from "@/lib/platform-traffic/book-mall-origin";
import {
  buildShareCodePageUrl,
  normalizeShareCode,
  resolveShareCode,
} from "@/lib/share/share-code-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const code = normalizeShareCode(raw);
  if (!code) {
    return NextResponse.json({ error: "缺少 code" }, { status: 400 });
  }

  const resolved = await resolveShareCode(code);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 404 });
  }

  const origin =
    resolveBookMallOrigin() ??
    request.nextUrl.origin.replace(/\/$/, "");
  const url = buildShareCodePageUrl(origin, code);

  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
