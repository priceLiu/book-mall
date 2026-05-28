import { NextRequest, NextResponse } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";

export const dynamic = "force-dynamic";

async function proxyToBookMall(request: NextRequest, pathSegments: string[]) {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return NextResponse.json(
      { error: "book_mall_url_missing" },
      { status: 503 },
    );
  }

  const path = pathSegments.join("/");
  const upstream = `${base}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const toolsToken = request.cookies.get("tools_token")?.value?.trim();
  if (toolsToken) headers.set("authorization", `Bearer ${toolsToken}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  try {
    const r = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    const respBuf = await r.arrayBuffer();
    return new NextResponse(respBuf, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/json",
      },
    });
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
