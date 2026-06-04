import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get("tools_token")?.value?.trim();
  const origin = getMainSiteOrigin();
  if (!origin || !token) {
    return NextResponse.json({
      hasCookie: Boolean(token),
      active: false,
      introspect: null,
    });
  }
  const res = await fetch(`${origin}/api/sso/tools/introspect`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const introspect = await res.json().catch(() => null);
  return NextResponse.json({
    hasCookie: true,
    active: res.ok && Boolean((introspect as { active?: boolean })?.active),
    introspect,
    introspectStatus: res.status,
  });
}
