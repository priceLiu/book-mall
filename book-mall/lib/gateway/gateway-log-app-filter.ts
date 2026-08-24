/**
 * Gateway 请求日志 · 应用 Tab 筛选（SSOT）。
 * 按 clientSource + clientPage 组合区分 AI 小智 / 日常工具 / 主站 Book 等。
 */
import type { Prisma } from "@prisma/client";

import { PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } from "@/lib/platform-assistant/platform-assistant-billing";

export const GATEWAY_LOG_APP_KEYS = [
  "assistant",
  "book",
  "tool",
  "quick-replica",
  "prompt-optimizer",
  "canvas",
  "story",
  "e-commerce",
  "gateway-console",
  "external",
] as const;

export type GatewayLogAppKey = (typeof GATEWAY_LOG_APP_KEYS)[number];

export const GATEWAY_LOG_APP_LABELS: Record<GatewayLogAppKey, string> = {
  assistant: "AI 小智",
  book: "主站 Book",
  tool: "日常工具",
  "quick-replica": "快速复刻",
  "prompt-optimizer": "提示词",
  canvas: "画布",
  story: "故事版",
  "e-commerce": "电商工具箱",
  "gateway-console": "控制台",
  external: "外部 API",
};

/** Gateway 日志页 · Tab 顺序（含「全部」） */
export const GATEWAY_LOG_APP_FILTER_OPTIONS: {
  value: "" | GatewayLogAppKey;
  label: string;
}[] = [
  { value: "", label: "全部" },
  ...GATEWAY_LOG_APP_KEYS.map((key) => ({
    value: key,
    label: GATEWAY_LOG_APP_LABELS[key],
  })),
];

const PROMPT_OPTIMIZER_PAGE_OR: Prisma.GatewayRequestLogWhereInput[] = [
  { clientPage: { startsWith: "prompt-optimizer" } },
  { clientPage: "prompt-optimizer" },
];

const QUICK_REPLICA_PAGE_OR: Prisma.GatewayRequestLogWhereInput[] = [
  { clientSource: "QUICK_REPLICA" },
  { clientPage: { startsWith: "quick-replica/" } },
  { clientPage: { startsWith: "quick-replica" } },
];

export function isGatewayLogAppKey(raw: string): raw is GatewayLogAppKey {
  return (GATEWAY_LOG_APP_KEYS as readonly string[]).includes(raw);
}

/** 解析 appKey 查询参数；兼容旧 clientSource 枚举值。 */
export function parseGatewayLogAppKey(
  raw: string | null | undefined,
): GatewayLogAppKey | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (isGatewayLogAppKey(lower)) return lower;

  switch (v.toUpperCase()) {
    case "CANVAS":
      return "canvas";
    case "STORY":
      return "story";
    case "E_COMMERCE":
      return "e-commerce";
    case "GATEWAY_CONSOLE":
      return "gateway-console";
    case "EXTERNAL":
      return "external";
    case "QUICK_REPLICA":
      return "quick-replica";
    case "ASSISTANT":
      return "assistant";
    case "BOOK":
      return "book";
    case "PROMPT_OPTIMIZER":
    case "PROMPT-OPTIMIZER":
      return "prompt-optimizer";
    case "TOOL":
      return "tool";
    default:
      return undefined;
  }
}

export function buildGatewayLogAppWhere(
  appKey: GatewayLogAppKey,
): Prisma.GatewayRequestLogWhereInput {
  switch (appKey) {
    case "assistant":
      return {
        clientPage: { startsWith: PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX },
      };
    case "book":
      return { clientPage: { startsWith: "account/" } };
    case "tool":
      return {
        AND: [
          { clientSource: "TOOL" },
          { NOT: { clientPage: { startsWith: PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } } },
          { NOT: { OR: PROMPT_OPTIMIZER_PAGE_OR } },
        ],
      };
    case "quick-replica":
      return { OR: QUICK_REPLICA_PAGE_OR };
    case "prompt-optimizer":
      return { OR: PROMPT_OPTIMIZER_PAGE_OR };
    case "canvas":
      return { clientSource: "CANVAS" };
    case "story":
      return { clientSource: "STORY" };
    case "e-commerce":
      return { clientSource: "E_COMMERCE" };
    case "gateway-console":
      return { clientSource: "GATEWAY_CONSOLE" };
    case "external":
      return {
        AND: [
          { clientSource: "EXTERNAL" },
          { NOT: { clientPage: { startsWith: "account/" } } },
        ],
      };
    default: {
      const _exhaustive: never = appKey;
      return _exhaustive;
    }
  }
}
