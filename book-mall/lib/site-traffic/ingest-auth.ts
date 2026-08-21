import type { NextRequest } from "next/server";

import { platformTrafficIngestSecrets } from "@/lib/platform-traffic/traffic-ingest-secret";

export type TrafficIngestAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** internal platform-traffic ingest · Bearer TOOLS_SSO_SERVER_SECRET 或 GATEWAY_SSO_SERVER_SECRET */
export function authorizeTrafficIngest(req: NextRequest): TrafficIngestAuthResult {
  const allowed = platformTrafficIngestSecrets();
  if (allowed.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "TOOLS_SSO_SERVER_SECRET / GATEWAY_SSO_SERVER_SECRET 未配置",
    };
  }

  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const bearer = match ? match[1]!.trim() : "";
  if (bearer && allowed.includes(bearer)) {
    return { ok: true };
  }

  return { ok: false, status: 403, error: "需要 SSO server secret" };
}
