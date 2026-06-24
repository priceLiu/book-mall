import { NextRequest, NextResponse } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import {
  callBookMallRefreshToken,
  decodeJwtSub,
  ensureProxyToolsBearer,
} from "@/lib/book-mall-proxy-auth";

export const dynamic = "force-dynamic";

/** SSE / 纯文本流式接口须透传 body，不可 buffer 成一次性响应 */
function shouldStreamProxyResponse(contentType: string, path: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes("text/event-stream")) return true;
  if (ct.startsWith("text/plain")) return true;
  if (path.includes("script-assistant/chat")) return true;
  return false;
}

function bookMallRouteMissingResponse(path: string, status: number) {
  return NextResponse.json(
    {
      error: "book_mall_route_missing",
      message:
        `主站 book-mall 未提供 /${path}（HTTP ${status}）。` +
        "请部署含私域人像入库 API 的最新 book-mall，并执行 prisma migrate deploy。",
      path: `/${path}`,
    },
    { status: 502 },
  );
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

async function proxyToBookMall(
  request: NextRequest,
  pathSegments: string[],
) {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return NextResponse.json(
      { error: "book_mall_url_missing" },
      { status: 503 },
    );
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
      outHeaders.set("Content-Type", contentType);
      outHeaders.set("Cache-Control", "no-store");
      outHeaders.set("X-Accel-Buffering", "no");
      const encoding = r.headers.get("content-encoding");
      if (encoding) outHeaders.set("Content-Encoding", encoding);
      const streamRes = new NextResponse(r.body, {
        status: r.status,
        headers: outHeaders,
      });
      return attachRefreshedToolsCookie(streamRes, refreshed);
    }
    const respBuf = await r.arrayBuffer();
    const ctLower = contentType.toLowerCase();
    if (
      (r.status === 404 || r.status === 405) &&
      ctLower.includes("text/html")
    ) {
      return bookMallRouteMissingResponse(path, r.status);
    }
    const jsonRes = new NextResponse(respBuf, {
      status: r.status,
      headers: {
        "Content-Type": contentType,
      },
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
