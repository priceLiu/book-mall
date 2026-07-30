function trimOrigin(raw: string | undefined, fallback: string): string {
  const v = raw?.trim().replace(/\/$/, "");
  return v || fallback;
}

export function getStoryWebOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://story.ai-code8.com"
      : "http://localhost:3003",
  );
}

export function getCanvasWebOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://canvas.ai-code8.com"
      : "http://localhost:3004",
  );
}

export function getEcommerceWebOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN ??
      process.env.ECOMMERCE_PUBLIC_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://ecom.ai-code8.com"
      : "http://localhost:3007",
  );
}

export function getPromptOptimizerOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN ??
      process.env.PROMPT_OPTIMIZER_PUBLIC_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://prompt.ai-code8.com"
      : "http://localhost:3006",
  );
}

export function getQuickReplicaOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN ??
      process.env.QUICK_REPLICA_PUBLIC_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://replica.ai-code8.com"
      : "http://localhost:3008",
  );
}

export function getDirectorWebOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN ??
      process.env.DIRECTOR_WEB_PUBLIC_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://director.ai-code8.com"
      : "http://localhost:3009",
  );
}

export function getCommonToolsOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN ??
      process.env.COMMON_TOOLS_PUBLIC_ORIGIN,
    process.env.NODE_ENV === "production"
      ? "https://common.ai-code8.com"
      : "http://localhost:3010",
  );
}

export function buildAppWebUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
