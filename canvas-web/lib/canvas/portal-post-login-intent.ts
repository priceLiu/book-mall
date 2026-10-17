/** 首页门户：未登录点「开始创作」→ Book 登录 → 回首页自动建项 */

export const CANVAS_PORTAL_ACTION_CREATE_PRO2 = "create-pro2-blank";
export const CANVAS_PORTAL_ACTION_DUPLICATE_FEATURED = "duplicate-featured";

const STORAGE_CREATE_PRO2 = "canvas_portal_intent_create_pro2";
const STORAGE_DUPLICATE_FEATURED_ID = "canvas_portal_intent_duplicate_featured_id";

export function canvasPortalHomeActionHref(action: string): string {
  const q = new URLSearchParams({ action });
  return `/?${q.toString()}`;
}

export function markCanvasPortalCreatePro2Intent(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_CREATE_PRO2, "1");
}

export function markCanvasPortalDuplicateFeaturedIntent(featuredId: string): void {
  if (typeof sessionStorage === "undefined") return;
  const id = featuredId.trim();
  if (!id) return;
  sessionStorage.setItem(STORAGE_DUPLICATE_FEATURED_ID, id);
}

export type CanvasPortalPostLoginIntent =
  | { kind: "create-pro2" }
  | { kind: "duplicate-featured"; featuredId: string };

export function readCanvasPortalPostLoginIntent(
  search: string,
): CanvasPortalPostLoginIntent | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    params = new URLSearchParams();
  }
  const action = params.get("action")?.trim();

  if (action === CANVAS_PORTAL_ACTION_CREATE_PRO2) {
    return { kind: "create-pro2" };
  }
  if (action === CANVAS_PORTAL_ACTION_DUPLICATE_FEATURED) {
    const id =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(STORAGE_DUPLICATE_FEATURED_ID)?.trim()
        : "";
    if (id) return { kind: "duplicate-featured", featuredId: id };
  }

  if (typeof sessionStorage !== "undefined") {
    if (sessionStorage.getItem(STORAGE_CREATE_PRO2) === "1") {
      return { kind: "create-pro2" };
    }
    const dupId = sessionStorage.getItem(STORAGE_DUPLICATE_FEATURED_ID)?.trim();
    if (dupId) return { kind: "duplicate-featured", featuredId: dupId };
  }

  return null;
}

export function clearCanvasPortalPostLoginIntent(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_CREATE_PRO2);
  sessionStorage.removeItem(STORAGE_DUPLICATE_FEATURED_ID);
}

export function stripCanvasPortalActionFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("action")) return;
  url.searchParams.delete("action");
  const next =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams}` : "") +
    url.hash;
  window.history.replaceState(null, "", next);
}
