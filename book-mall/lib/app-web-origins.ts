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

export function buildAppWebUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
