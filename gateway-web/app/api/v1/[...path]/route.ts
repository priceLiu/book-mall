import { NextRequest, NextResponse } from "next/server";
import { getBookMallOrigin } from "@/lib/book-mall-base-url";
import { bookMallFetchErrorMessage, fetchBookMall } from "@/lib/fetch-book-mall";

export const dynamic = "force-dynamic";

async function proxyToBookMallGw(request: NextRequest, pathSegments: string[]) {
  const base = getBookMallOrigin();
  if (!base) {
    return NextResponse.json(
      { error: "BOOK_MALL_ORIGIN 未配置" },
      { status: 503 },
    );
  }

  const path = pathSegments.join("/");
  const upstream = `${base}/api/gw/v1/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

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
        error: "gw_proxy_failed",
        message: bookMallFetchErrorMessage(e),
      },
      { status: 502 },
    );
  }
}

type RouteCtx = { params: { path: string[] } };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMallGw(request, ctx.params.path);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMallGw(request, ctx.params.path);
}

export async function OPTIONS(request: NextRequest, ctx: RouteCtx) {
  return proxyToBookMallGw(request, ctx.params.path);
}
