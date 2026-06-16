import {
  getCanvasWebOrigin,
  getEcommerceWebOrigin,
  getPromptOptimizerOrigin,
  getStoryWebOrigin,
} from "@/lib/app-web-origins";
import { getBookMallOrigin } from "@/lib/gateway/env";
import { getToolsPublicOrigin } from "@/lib/sso-tools-env";

function trimOrigin(raw: string | null | undefined): string | null {
  const v = raw?.trim().replace(/\/$/, "");
  return v && v.startsWith("http") ? v : null;
}

/** 本地 dev 默认端口（env 未配齐时 federated logout / next 校验仍可用）。 */
export const LOCAL_PLATFORM_WEB_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3006",
  "http://localhost:3007",
] as const;

/** 全站子应用 Origin（federated logout 链 / tools-logout next 白名单）。 */
export function listPlatformWebOrigins(selfOrigin?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const o = trimOrigin(raw);
    if (!o || seen.has(o)) return;
    seen.add(o);
    out.push(o);
  };

  for (const raw of [
    getBookMallOrigin(),
    getToolsPublicOrigin(),
    getCanvasWebOrigin(),
    getStoryWebOrigin(),
    getPromptOptimizerOrigin(),
    getEcommerceWebOrigin(),
    selfOrigin,
  ]) {
    push(raw);
  }

  if (process.env.NODE_ENV !== "production") {
    for (const o of LOCAL_PLATFORM_WEB_ORIGINS) push(o);
  }

  return out;
}
