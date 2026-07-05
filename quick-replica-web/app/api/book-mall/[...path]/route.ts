import { NextRequest, NextResponse } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import {
  callBookMallRefreshToken,
  decodeJwtSub,
  ensureProxyToolsBearer,
} from "@/lib/book-mall-proxy-auth";

export const dynamic = "force-dynamic";

function shouldStreamProxyResponse(contentType: string, path: string): boolean {
  const ct = contentType.toLowerCase();
  const p = path.toLowerCase();
  if (ct.includes("text/event-stream")) return true;
  if (ct.startsWith("text/plain")) return true;
  if (p.includes("gateway/chat")) return true;
  // World splat / image 可达数百 MB，禁止 arrayBuffer 整包缓冲（否则高清档永远下不完）
  if (
    p.includes("quick-replica/worlds/") &&
    (p.includes("/splat") || p.includes("/image"))
  ) {
    return true;
  }
  if (ct.includes("application/octet-stream")) return true;
  return false;
}

function passthroughUpstreamHeaders(upstream: Response, out: Headers): void {
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.set("Content-Type", contentType);
  out.set("Cache-Control", upstream.headers.get("cache-control") ?? "no-store");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) out.set("Content-Length", contentLength);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) out.set("Content-Disposition", disposition);
  const encoding = upstream.headers.get("content-encoding");
  if (encoding) out.set("Content-Encoding", encoding);
}

function attachRefreshedToolsCookie(
  response: NextResponse,
  refreshed: { accessToken: string; expiresIn: number } | null,
): NextResponse {
  if (!refreshed) return response;
  response.cookies.set("tools_token", refreshed.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: refreshed.expiresIn,
  });
  return response;
}

async function fetchUpstream(
  request: NextRequest,
  upstream: string,
  bearer: string | null,
  body: ArrayBuffer | undefined,
): Promise<Response> {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  return fetch(upstream, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });
}

async function proxyToBookMall(request: NextRequest, pathSegments: string[]) {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return NextResponse.json({ error: "book_mall_url_missing" }, { status: 503 });
  }

  const path = pathSegments.join("/");
  const upstream = `${base}/${path}${request.nextUrl.search}`;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let { bearer, refreshed } = await ensureProxyToolsBearer(request);

  try {
    let r = await fetchUpstream(request, upstream, bearer, body);

    if (r.status === 401) {
      const forced = await callBookMallRefreshToken(
        request,
        bearer ?? request.cookies.get("tools_token")?.value?.trim() ?? null,
        bearer ? decodeJwtSub(bearer) : null,
      );
      if (forced && forced.accessToken !== bearer) {
        bearer = forced.accessToken;
        refreshed = forced;
        r = await fetchUpstream(request, upstream, bearer, body);
      }
    }

    const contentType = r.headers.get("content-type") ?? "application/json";
    if (shouldStreamProxyResponse(contentType, path) && r.body) {
      const outHeaders = new Headers();
      passthroughUpstreamHeaders(r, outHeaders);
      outHeaders.set("X-Accel-Buffering", "no");
      const streamRes = new NextResponse(r.body, {
        status: r.status,
        headers: outHeaders,
      });
      return attachRefreshedToolsCookie(streamRes, refreshed);
    }
    const respBuf = await r.arrayBuffer();
    const jsonRes = new NextResponse(respBuf, {
      status: r.status,
      headers: { "Content-Type": contentType },
    });
    return attachRefreshedToolsCookie(jsonRes, refreshed);
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "book_mall_proxy_failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function POST(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function OPTIONS(
  request: NextRequest,
  ctx: { params: { path: string[] } },
) {
  return proxyToBookMall(request, ctx.params.path);
}
