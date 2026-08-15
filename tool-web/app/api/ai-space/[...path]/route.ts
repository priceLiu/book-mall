import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** 我的 AI 空间 Platform API 同域 BFF（契约见 book-mall/doc/product/我的AI空间.md §8） */
const UPSTREAM_PREFIX = "/api/platform/v1/ai-space";

async function proxy(req: Request, segments: string[]): Promise<NextResponse> {
  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin) {
    return NextResponse.json({ error: "main_origin_not_configured" }, { status: 503 });
  }
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const search = new URL(req.url).search;
  const upstream = `${origin}${UPSTREAM_PREFIX}/${segments.join("/")}${search}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const r = await fetch(upstream, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    cache: "no-store",
  });
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

type Ctx = { params: { path: string[] } };

export async function GET(req: Request, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function POST(req: Request, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function PATCH(req: Request, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}

export async function DELETE(req: Request, ctx: Ctx) {
  return proxy(req, ctx.params.path);
}
