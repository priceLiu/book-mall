import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type CanvasViewerUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export async function fetchCanvasViewerUser(
  base: string,
  signal?: AbortSignal,
): Promise<CanvasViewerUser | null> {
  if (!base) return null;
  try {
    const { url, init } = resolveBookMallBrowserRequest(
      base,
      "/api/canvas/viewer-session",
      { signal },
    );
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const j = (await res.json()) as { user: CanvasViewerUser | null };
    return j.user ?? null;
  } catch {
    return null;
  }
}

export function bookMallLoginHref(base: string, returnTo: string): string {
  const origin = base.replace(/\/$/, "");
  return `${origin}/login?callbackUrl=${encodeURIComponent(returnTo)}`;
}
