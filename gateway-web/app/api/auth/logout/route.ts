import { NextResponse } from "next/server";
import { clearGatewayToken } from "@/lib/gateway-auth";
import { gatewayFetch } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

export async function POST() {
  await gatewayFetch("/api/gateway/auth/session", { method: "DELETE" });
  const res = NextResponse.json({ ok: true });
  clearGatewayToken(res);
  return res;
}
