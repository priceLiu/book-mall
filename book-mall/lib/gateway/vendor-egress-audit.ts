/**
 * 厂商直连出口审计（业务层 → 厂商 API 的旁路调用留痕）。
 *
 * 背景：历史 `DEEPSEEK_API_KEY` 直连路径绕过 Gateway 与所有任务表，
 * 厂商侧 3.5k 次调用平台零记录。本钩子挂在业务层 provider gateway
 * （OpenAiCompatGateway 等）的计费调用入口：
 *   - 命中已知厂商域名 → 写 PlatformErrorLog（SYSTEM / VENDOR_DIRECT_EGRESS）
 *   - host 在阻断名单（PlatformConfig.vendorDirectBlockHosts / VENDOR_DIRECT_BLOCK_HOSTS）→ 记 ERROR 并 console 阻断
 *
 * Gateway 内部转发路径（model-router / proxy-common）不经过此钩子，
 * 不会误伤合法流量；KIE / 混元 3D 等 allowlist 内的系统 provider 会被审计记录。
 */
import { recordPlatformError } from "@/lib/platform-error-log";
import { vendorKeyFingerprint } from "@/lib/gateway/legacy-vendor-env-sentinel";

const KNOWN_VENDOR_HOST_RE =
  /(?:^|\.)(?:api\.deepseek\.com|dashscope\.aliyuncs\.com|dashscope-intl\.aliyuncs\.com|api\.moonshot\.cn|ark\.cn-beijing\.volces\.com|api\.kie\.ai|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.minimaxi\.com|api\.minimax\.chat|api\.elevenlabs\.io)$/i;

export function extractUrlHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.toLowerCase();
  } catch {
    return "";
  }
}

export function isKnownVendorHost(host: string): boolean {
  return KNOWN_VENDOR_HOST_RE.test(host);
}

/** VENDOR_DIRECT_BLOCK_HOSTS=api.deepseek.com,api.moonshot.cn → 小写 host 列表 */
export function parseVendorDirectBlockHosts(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = env.VENDOR_DIRECT_BLOCK_HOSTS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export type VendorDirectEgressInput = {
  baseUrl: string;
  model?: string;
  apiKey?: string;
  /** 调用位置，如 "OpenAiCompatGateway.chat" */
  caller: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * 审计一次业务层直连厂商调用；host 在阻断名单时抛 CanvasGatewayError。
 * 阻断名单：PlatformConfig（/admin/settings）> VENDOR_DIRECT_BLOCK_HOSTS env > 空。
 * 非已知厂商域名（自建中转等）静默放行——避免误伤与噪音。
 */
export function auditVendorDirectEgress(input: VendorDirectEgressInput): void {
  const host = extractUrlHost(input.baseUrl);
  if (!host || !isKnownVendorHost(host)) return;

  const keyFp = input.apiKey?.trim()
    ? vendorKeyFingerprint(input.apiKey.trim())
    : "";
  const stack = new Error().stack?.split("\n").slice(2, 8).join("\n") ?? "";

  void (async () => {
    let blockHosts: string[];
    try {
      const { resolveVendorDirectBlockHostsAsync } = await import(
        "@/lib/admin/logging-fuse-config-service"
      );
      blockHosts = await resolveVendorDirectBlockHostsAsync();
    } catch {
      blockHosts = parseVendorDirectBlockHosts(input.env);
    }
    const blocked = blockHosts.includes(host);

    recordPlatformError({
      source: "SYSTEM",
      severity: blocked ? "ERROR" : "WARN",
      code: blocked ? "VENDOR_DIRECT_BLOCKED" : "VENDOR_DIRECT_EGRESS",
      message: blocked
        ? `业务层直连厂商已被阻断：${host}（该厂商调用必须经 Gateway）`
        : `业务层直连厂商调用：${host}（绕过 Gateway，须排查为何未走 gw-* 通道）`,
      detail: stack || undefined,
      context: {
        vendorHost: host,
        modelKey: input.model ?? undefined,
        keyFingerprint: keyFp || undefined,
        caller: input.caller,
      },
    });

    if (blocked) {
      console.error(
        `[vendor-egress-audit] 直连 ${host} 已被平台策略阻断（caller=${input.caller}）；请改用 Gateway`,
      );
    }
  })();
}
