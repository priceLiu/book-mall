/**
 * 平台错误日志 · 应用 Tab 筛选（与 Gateway 日志应用 taxonomy 对齐）。
 */
import type { Prisma } from "@prisma/client";

import {
  GATEWAY_LOG_APP_KEYS,
  GATEWAY_LOG_APP_LABELS,
  type GatewayLogAppKey,
  isGatewayLogAppKey,
  parseGatewayLogAppKey,
} from "@/lib/gateway/gateway-log-app-filter";
import { PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } from "@/lib/platform-assistant/platform-assistant-constants";

export type PlatformErrorAppKey = GatewayLogAppKey | "system";

export const PLATFORM_ERROR_APP_KEYS = [
  ...GATEWAY_LOG_APP_KEYS,
  "system",
] as const;

export const PLATFORM_ERROR_APP_LABELS: Record<PlatformErrorAppKey, string> = {
  ...GATEWAY_LOG_APP_LABELS,
  system: "系统",
};

export const PLATFORM_ERROR_APP_FILTER_OPTIONS: {
  value: "" | PlatformErrorAppKey;
  label: string;
}[] = [
  { value: "", label: "全部" },
  ...PLATFORM_ERROR_APP_KEYS.map((key) => ({
    value: key,
    label: PLATFORM_ERROR_APP_LABELS[key],
  })),
];

export function parsePlatformErrorAppKey(
  raw: string | null | undefined,
): PlatformErrorAppKey | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v.toLowerCase() === "system") return "system";
  return parseGatewayLogAppKey(v);
}

function clientPageStartsWith(prefix: string): Prisma.PlatformErrorLogWhereInput {
  return {
    context: {
      path: ["clientPage"],
      string_starts_with: prefix,
    },
  };
}

function clientPageEquals(value: string): Prisma.PlatformErrorLogWhereInput {
  return {
    context: {
      path: ["clientPage"],
      equals: value,
    },
  };
}

export function buildPlatformErrorAppWhere(
  appKey: PlatformErrorAppKey,
): Prisma.PlatformErrorLogWhereInput {
  if (appKey === "system") {
    return { source: "SYSTEM" };
  }

  if (!isGatewayLogAppKey(appKey)) {
    return {};
  }

  switch (appKey) {
    case "assistant":
      return clientPageStartsWith(PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX);
    case "book":
      return {
        OR: [
          { source: "BOOK" },
          clientPageStartsWith("account/"),
        ],
      };
    case "tool":
      return {
        OR: [
          {
            AND: [
              { source: "TOOL" },
              {
                NOT: clientPageStartsWith(PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX),
              },
              {
                NOT: {
                  OR: [
                    clientPageStartsWith("prompt-optimizer"),
                    clientPageEquals("prompt-optimizer"),
                  ],
                },
              },
            ],
          },
          {
            AND: [
              { source: "GATEWAY" },
              {
                NOT: clientPageStartsWith(PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX),
              },
              {
                NOT: {
                  OR: [
                    clientPageStartsWith("prompt-optimizer"),
                    clientPageEquals("prompt-optimizer"),
                    clientPageStartsWith("account/"),
                    clientPageStartsWith("canvas/"),
                    clientPageStartsWith("quick-replica"),
                  ],
                },
              },
            ],
          },
        ],
      };
    case "quick-replica":
      return {
        OR: [
          clientPageStartsWith("quick-replica"),
          {
            AND: [
              { source: "GATEWAY" },
              clientPageStartsWith("quick-replica"),
            ],
          },
        ],
      };
    case "prompt-optimizer":
      return {
        OR: [
          clientPageStartsWith("prompt-optimizer"),
          clientPageEquals("prompt-optimizer"),
        ],
      };
    case "canvas":
      return {
        OR: [{ source: "CANVAS" }, clientPageStartsWith("canvas/")],
      };
    case "story":
      return { source: "STORY" };
    case "e-commerce":
      return {
        OR: [
          clientPageStartsWith("ecom/"),
          {
            AND: [
              { source: "GATEWAY" },
              clientPageStartsWith("ecom/"),
            ],
          },
        ],
      };
    case "gateway-console":
      return { source: "GATEWAY" };
    case "external":
      return {
        AND: [
          { source: "GATEWAY" },
          {
            NOT: {
              OR: [
                clientPageStartsWith("account/"),
                clientPageStartsWith("platform-assistant/"),
                clientPageStartsWith("prompt-optimizer"),
                clientPageStartsWith("quick-replica"),
                clientPageStartsWith("canvas/"),
                clientPageStartsWith("ecom/"),
              ],
            },
          },
        ],
      };
    default: {
      const _exhaustive: never = appKey;
      return _exhaustive;
    }
  }
}
