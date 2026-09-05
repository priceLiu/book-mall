/** DeepSeek 控制台 api_key_name ↔ Gateway channelSnapshot 归一（多 Key 策略）。 */

const LEGACY_VENDOR_KEY_TO_CHANNEL: Record<string, string> = {
  "book mall": "gw-platform-pool",
  "book-mall": "gw-platform-pool",
  bookmall: "gw-platform-pool",
  bilibili: "gw-platform-pool",
  canvas: "gw-canvas-pro2",
};

/** 控制台 Key 名归一：trim、小写、连续空白折叠为单空格 */
export function normalizeDeepseekVendorKeyName(apiKeyName: string): string {
  const raw = apiKeyName.trim().replace(/\s+/g, " ");
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  return LEGACY_VENDOR_KEY_TO_CHANNEL[lower] ?? raw;
}

export function normalizeGatewayCredentialChannel(
  channelSnapshot: string | null | undefined,
  credentialAliasSnapshot?: string | null,
): string {
  const ch = channelSnapshot?.trim();
  if (ch) return normalizeDeepseekVendorKeyName(ch);
  const alias = credentialAliasSnapshot?.trim();
  if (alias) return normalizeDeepseekVendorKeyName(alias);
  return "gw-platform-pool";
}

export const DEEPSEEK_CHANNEL_LABELS: Record<string, string> = {
  "gw-platform-pool": "Book Mall · gw-platform-pool",
  "gw-canvas-pro2": "Canvas Pro2 · gw-canvas-pro2",
  "gw-assistant": "AI 小智 · gw-assistant",
  "gw-tool": "工具站 · gw-tool",
  "book mall": "Book Mall · 现网 Gateway DeepSeek",
  "book-mall": "Book Mall · 现网 Gateway DeepSeek",
  canvas: "历史直连 · canvas（已删除）",
  bilibili: "历史 · bilibili → Book Mall / gw-platform-pool",
};

export function channelKeyLabel(key: string): string {
  return DEEPSEEK_CHANNEL_LABELS[key] ?? key;
}
