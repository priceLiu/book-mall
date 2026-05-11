import { Agent, fetch as undiciFetch } from "undici";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "static-main.aiyeshi.cn";
const ALLOWED_PATH_PREFIX = "/ai-fitroom/";
const MAX_BYTES = 15 * 1024 * 1024;

function strictUpstreamTls(): boolean {
  return process.env.FIT_IMAGE_PROXY_STRICT_TLS === "1";
}

function assertAllowedUrl(u: URL): void {
  if (u.hostname !== ALLOWED_HOST) {
    throw new Error("forbidden host");
  }
  if (u.protocol !== "https:") {
    throw new Error("https only");
  }
  if (!u.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
    throw new Error("forbidden path");
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return new NextResponse("missing url", { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }

  try {
    assertAllowedUrl(url);
  } catch {
    return new NextResponse("forbidden", { status: 403 });
  }

  const strict = strictUpstreamTls();

  const dispatcher = strict
    ? undefined
    : new Agent({
        connect: { rejectUnauthorized: false },
      });

  try {
    const res = await undiciFetch(url.href, {
      dispatcher,
      redirect: "follow",
      headers: {
        "User-Agent": "tool-web-fit-image-proxy/1.1",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error("[fit-image] upstream status", res.status, raw.slice(0, 100));
      }
      return new NextResponse(null, { status: 502 });
    }

    let finalUrl: URL;
    try {
      finalUrl = new URL(res.url);
    } catch {
      return new NextResponse(null, { status: 502 });
    }

    try {
      assertAllowedUrl(finalUrl);
    } catch {
      return new NextResponse(null, { status: 403 });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return new NextResponse(null, { status: 502 });
    }

    const ct =
      res.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": ct.startsWith("image/") ? ct : "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fit-image]", raw.slice(0, 120), e);
    }
    return new NextResponse(null, { status: 502 });
  }
}
