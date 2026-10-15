import type { QrCategory } from "@/lib/qr-template-types";
import { QR_CATEGORIES } from "@/lib/qr-template-types";

export type QrAppNavMode =
  | "home"
  | "category"
  | "my-works"
  | "generate-history"
  | "pinned-tool";

export type QrAppMiddleMode = "browse" | "workspace" | "welcome";

export type QrAppRouteState = {
  navMode: QrAppNavMode;
  middleMode: QrAppMiddleMode;
  category: QrCategory;
  selectedKind: string | null;
  pinnedToolKey: string | null;
  myWorksCategory: QrCategory;
};

const CATEGORY_SET = new Set<string>(QR_CATEGORIES.map((c) => c.id));

function parseCategory(raw: string | undefined): QrCategory | null {
  if (!raw || !CATEGORY_SET.has(raw)) return null;
  return raw as QrCategory;
}

function defaultRouteState(): QrAppRouteState {
  return {
    navMode: "home",
    middleMode: "welcome",
    category: "video",
    selectedKind: null,
    pinnedToolKey: null,
    myWorksCategory: "audio",
  };
}

/** 从 URL 解析应用导航（服务端 / 客户端均可） */
export function parseQrAppRouteFromSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): QrAppRouteState | null {
  const params =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(
          Object.entries(input).flatMap(([key, val]): [string, string][] => {
            if (val === undefined) return [];
            if (Array.isArray(val)) return val.map((v) => [key, v]);
            return [[key, val]];
          }),
        );

  if (params.get("templateId")?.trim()) {
    return null;
  }

  const legacyCategory = parseCategory(params.get("category") ?? undefined);
  const viewRaw = params.get("view")?.trim();
  const view =
    viewRaw === "category" ||
    viewRaw === "my-works" ||
    viewRaw === "generate-history" ||
    viewRaw === "pinned-tool" ||
    viewRaw === "home"
      ? viewRaw
      : legacyCategory
        ? "category"
        : null;

  if (!view || view === "home") {
    return null;
  }

  const kind = params.get("kind")?.trim() || null;
  const toolKey = params.get("toolKey")?.trim() || null;

  if (view === "generate-history") {
    return {
      navMode: "generate-history",
      middleMode: "browse",
      category: "video",
      selectedKind: null,
      pinnedToolKey: null,
      myWorksCategory: "audio",
    };
  }

  if (view === "my-works") {
    const worksCat = parseCategory(params.get("category") ?? undefined) ?? "audio";
    return {
      navMode: "my-works",
      middleMode: "browse",
      category: worksCat,
      selectedKind: null,
      pinnedToolKey: null,
      myWorksCategory: worksCat,
    };
  }

  if (view === "pinned-tool") {
    const cat = parseCategory(params.get("category") ?? undefined);
    if (!cat || !toolKey || !kind) return null;
    return {
      navMode: "pinned-tool",
      middleMode: "workspace",
      category: cat,
      selectedKind: kind,
      pinnedToolKey: toolKey,
      myWorksCategory: "audio",
    };
  }

  const cat = parseCategory(params.get("category") ?? undefined) ?? legacyCategory;
  if (!cat) return null;

  let middleMode: QrAppMiddleMode = "browse";
  if (cat === "audio") {
    middleMode = "workspace";
  } else if (cat === "world") {
    middleMode = "browse";
  }

  return {
    navMode: "category",
    middleMode,
    category: cat,
    selectedKind: kind,
    pinnedToolKey: null,
    myWorksCategory: "audio",
  };
}

export function qrAppRouteDefaults(): QrAppRouteState {
  return defaultRouteState();
}

export function mergeQrAppRouteState(
  parsed: QrAppRouteState | null,
): QrAppRouteState {
  if (!parsed) return defaultRouteState();
  return parsed;
}

/** 将当前导航写入 query（保留 templateId 等外链参数） */
export function buildQrAppSearchParams(state: QrAppRouteState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.navMode === "home") {
    return params;
  }

  if (state.navMode === "generate-history") {
    params.set("view", "generate-history");
    return params;
  }

  if (state.navMode === "my-works") {
    params.set("view", "my-works");
    params.set("category", state.myWorksCategory);
    return params;
  }

  if (state.navMode === "pinned-tool") {
    params.set("view", "pinned-tool");
    params.set("category", state.category);
    if (state.pinnedToolKey) params.set("toolKey", state.pinnedToolKey);
    if (state.selectedKind) params.set("kind", state.selectedKind);
    return params;
  }

  params.set("view", "category");
  params.set("category", state.category);
  if (state.selectedKind) params.set("kind", state.selectedKind);
  return params;
}

export function writeQrAppRouteToLocation(state: QrAppRouteState): void {
  if (typeof window === "undefined") return;

  const built = buildQrAppSearchParams(state);
  const existing = new URLSearchParams(window.location.search);
  const templateId = existing.get("templateId")?.trim();
  if (templateId) built.set("templateId", templateId);

  const qs = built.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState({}, "", next);
  }
}

export function readSearchParamsFromRecord(
  searchParams?: Record<string, string | string[] | undefined>,
): URLSearchParams {
  if (!searchParams) return new URLSearchParams();
  return new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, val]): [string, string][] => {
      if (val === undefined) return [];
      if (Array.isArray(val)) return val.map((v) => [key, v]);
      return [[key, val]];
    }),
  );
}
