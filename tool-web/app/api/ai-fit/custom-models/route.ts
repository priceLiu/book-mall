import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

const UPSTREAM = "/api/sso/tools/ai-fit/custom-models";

export async function GET() {
  const origin = getMainSiteOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: "main_origin_not_configured" },
      { status: 503 },
    );
  }
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ models: [] });
  }

  const gate = await requireToolSuiteNavAccess("fitting-room");
  if (!gate.ok) return gate.response;

  const r = await fetch(`${origin.replace(/\/$/, "")}${UPSTREAM}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 401) {
    return NextResponse.json({ models: [] });
  }
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const origin = getMainSiteOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: "main_origin_not_configured" },
      { status: 503 },
    );
  }
  const suite = await requireToolSuiteNavAccess("fitting-room");
  if (!suite.ok) return suite.response;
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const body = await req.text();
  const r = await fetch(`${origin.replace(/\/$/, "")}${UPSTREAM}`, {
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
