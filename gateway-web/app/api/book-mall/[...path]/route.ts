import { NextRequest, NextResponse } from "next/server";
import { getBookMallOrigin } from "@/lib/book-mall-base-url";
import { bookMallFetchErrorMessage, fetchBookMall } from "@/lib/fetch-book-mall";

export const dynamic = "force-dynamic";

async function proxyToBookMall(request: NextRequest, pathSegments: string[]) {
  const base = getBookMallOrigin();
  if (!base) {
    return NextResponse.json(
      { error: "BOOK_MALL_ORIGIN 未配置" },
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
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  try {
    const r = await fetchBookMall(upstream, {
      method: request.method,
      headers,
      body,
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
        message: bookMallFetchErrorMessage(e),
      },
      { status: 502 },
    );
  }
}

type RouteCtx = { params: { path: string[] } };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMall(request, ctx.params.path);
}

export async function OPTIONS(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMall(request, ctx.params.path);
}
