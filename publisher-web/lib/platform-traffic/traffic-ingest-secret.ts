/** @generated — 勿在此编辑；改 shared/platform-traffic 后运行 node scripts/sync-platform-traffic.mjs */

/**
 * 全站访问统计 ingest 鉴权：复用各应用 SSO 部署时已配置的 server secret，零新增 env。
 * Book 侧接受 TOOLS_SSO_SERVER_SECRET 或 GATEWAY_SSO_SERVER_SECRET（值可相同）。
 */

const MIN_LEN = 16;

function pushSecret(seen: Set<string>, out: string[], raw: string | undefined): void {
  const s = raw?.trim();
  if (!s || s.length < MIN_LEN || seen.has(s)) return;
  seen.add(s);
  out.push(s);
}

/** Book ingest API：允许的 Bearer 值列表 */
export function platformTrafficIngestSecrets(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  pushSecret(seen, out, process.env.TOOLS_SSO_SERVER_SECRET);
  pushSecret(seen, out, process.env.GATEWAY_SSO_SERVER_SECRET);
  return out;
}

/** 子应用 middleware 上报时携带的 Bearer（优先 TOOLS_SSO，Gateway 站仅有后者） */
export function pickTrafficIngestSecret(): string | null {
  return platformTrafficIngestSecrets()[0] ?? null;
}
