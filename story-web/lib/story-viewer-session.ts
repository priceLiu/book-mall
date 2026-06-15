import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type StoryViewerUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: string;
};

export async function fetchStoryViewerUser(
  base: string,
  signal?: AbortSignal,
): Promise<StoryViewerUser | null> {
  if (!base) return null;
  try {
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/story/viewer-session", {
      signal,
    });
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const j = (await res.json()) as { user: StoryViewerUser | null };
    return j.user ?? null;
  } catch {
    return null;
  }
}

export function bookMallLoginHref(base: string, returnTo: string): string {
  const origin = base.replace(/\/$/, "");
  return `${origin}/login?callbackUrl=${encodeURIComponent(returnTo)}`;
}
