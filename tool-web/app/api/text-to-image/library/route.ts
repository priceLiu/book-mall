import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

const UPSTREAM = "/api/sso/tools/text-to-image/library";

function originOrError(): string | NextResponse {
  const origin = getMainSiteOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: "main_origin_not_configured" },
      { status: 503 },
    );
  }
  return origin.replace(/\/$/, "");
}

function tokenOrError(): string | NextResponse {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  return token;
}

export async function GET() {
  const origin = originOrError();
  if (origin instanceof NextResponse) return origin;
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ items: [] });
  }

  const r = await fetch(`${origin}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 401) {
    return NextResponse.json({ items: [] });
  }
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const origin = originOrError();
  if (origin instanceof NextResponse) return origin;
  const token = tokenOrError();
  if (token instanceof NextResponse) return token;

  const body = await req.text();
  const r = await fetch(`${origin}${UPSTREAM}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(req: Request) {
  const origin = originOrError();
  if (origin instanceof NextResponse) return origin;
  const token = tokenOrError();
  if (token instanceof NextResponse) return token;

  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const r = await fetch(
    `${origin}${UPSTREAM}?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
