"use client";

export type StoryToolsSessionClientInfo = {
  hasCookie: boolean;
  active: boolean;
  introspect: Record<string, unknown> | null;
};

let inflight: Promise<StoryToolsSessionClientInfo> | null = null;

export async function fetchStoryToolsSession(): Promise<StoryToolsSessionClientInfo> {
  if (!inflight) {
    inflight = (async () => {
      const res = await fetch("/api/tools-session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        hasCookie?: boolean;
        active?: boolean;
        introspect?: unknown;
      };
      const intro =
        data.introspect && typeof data.introspect === "object"
          ? (data.introspect as Record<string, unknown>)
          : null;
      return {
        hasCookie: Boolean(data.hasCookie),
        active: Boolean(data.active),
        introspect: intro,
      };
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function displayNameFromIntrospect(
  intro: Record<string, unknown> | null,
): string | null {
  if (!intro) return null;
  for (const key of ["name", "phone", "email", "sub"] as const) {
    const v = intro[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
