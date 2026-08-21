/** 全站访问统计 appKey · SSOT（与 doc/product/26-platform-traffic-analytics.md 一致） */

export const PLATFORM_TRAFFIC_APP_KEYS = [
  "book",
  "canvas",
  "story",
  "tool",
  "e-commerce",
  "quick-replica",
  "prompt-optimizer",
  "director",
  "common-tools",
  "publisher",
  "gateway",
  "finance",
] as const;

export type PlatformTrafficAppKey = (typeof PLATFORM_TRAFFIC_APP_KEYS)[number];

export function isPlatformTrafficAppKey(raw: string): raw is PlatformTrafficAppKey {
  return (PLATFORM_TRAFFIC_APP_KEYS as readonly string[]).includes(raw);
}

export function parsePlatformTrafficAppKey(raw: string | null | undefined): PlatformTrafficAppKey | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (v === "prompt_optimizer") return "prompt-optimizer";
  if (v === "quick_replica") return "quick-replica";
  if (v === "ecommerce") return "e-commerce";
  if (v === "common_tools") return "common-tools";
  return isPlatformTrafficAppKey(v) ? v : null;
}

export const PLATFORM_TRAFFIC_APP_LABELS: Record<PlatformTrafficAppKey, string> = {
  book: "主站 Book",
  canvas: "AI 画布",
  story: "漫剧空间",
  tool: "工具站",
  "e-commerce": "电商工具箱",
  "quick-replica": "快速复制",
  "prompt-optimizer": "提示词优化器",
  director: "3D 导演台",
  "common-tools": "常用工具",
  publisher: "一键发布",
  gateway: "Gateway",
  finance: "财务控制台",
};
