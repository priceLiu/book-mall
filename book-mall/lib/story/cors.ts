import type { NextRequest } from "next/server";

function appStoryCorsEnabled(): boolean {
  if (process.env.STORY_CORS_IN_APP?.trim() === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return !process.env.STORY_WEB_ORIGINS?.trim();
}

/** story-web 跨源前端；生产请设为实际域名列表，逗号分隔。 */
export function storyCorsHeaders(request: NextRequest): Record<string, string> {
  if (!appStoryCorsEnabled()) return {};

  const origin = request.headers.get("origin");
  const allowed = (process.env.STORY_WEB_ORIGINS ?? "http://localhost:3003")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
  return {};
}
