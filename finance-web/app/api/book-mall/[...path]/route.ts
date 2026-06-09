import { NextRequest, NextResponse } from "next/server";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";

export const dynamic = "force-dynamic";

async function proxyToBookMall(request: NextRequest, pathSegments: string[]) {
  const base = getBookMallBaseUrlServer();
  if (!base) {
    return NextResponse.json(
      { error: "book_mall_url_missing", hint: "请配置 BOOK_MALL_URL / NEXT_PUBLIC_BOOK_MALL_URL" },
      { status: 503 },
    );
  }

  const path = pathSegments.join("/");
  const upstream = `${base}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = contentType?.includes("multipart/form-data")
      ? await request.arrayBuffer()
      : await request.text();
  }

  try {
    const r = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    return new NextResponse(await r.text(), {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "upstream_fetch_failed", hint: `无法连接主站 ${base}：${detail}` },
      { status: 502 },
    );
  }
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToBookMall(request, path);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToBookMall(request, path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToBookMall(request, path);
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToBookMall(request, path);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToBookMall(request, path);
}
