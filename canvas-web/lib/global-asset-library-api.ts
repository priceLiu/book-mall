"use client";

import type { GlobalAssetLibraryApiClient } from "@/docker-shared/global-asset-library/types";
import type {
  FetchProjectItemsQuery,
  UnifiedAssetPickItem,
} from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { adminFromToolsSessionPayload } from "@/lib/canvas/use-canvas-shell-session";
import { fetchCanvasToolsSessionFull } from "@/lib/canvas-tools-session-fetch";

async function bookFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "请求失败");
  }
  return data;
}

export function createCanvasGlobalAssetLibraryApi(): GlobalAssetLibraryApiClient {
  return {
    async fetchCatalog(query) {
      const params = new URLSearchParams();
      if (query.kind) params.set("kind", query.kind);
      if (query.gender) params.set("gender", query.gender);
      if (query.keyword) params.set("keyword", query.keyword);
      if (query.limit) params.set("limit", String(query.limit));
      if (query.platformOnly) {
        params.set("platformOnly", "1");
        params.set("audience", "platform-hub");
      }
      if (query.tenantId?.trim()) params.set("tenantId", query.tenantId.trim());
      if (query.projectId?.trim()) params.set("projectId", query.projectId.trim());
      const data = await bookFetch(
        `api/platform/v1/global-asset-library/catalog?${params.toString()}`,
      );
      const items = Array.isArray(data.items) ? data.items : [];
      return {
        items: items.map((raw) => {
          const o = raw as Record<string, unknown>;
          return {
            id: String(o.id ?? ""),
            catalogKind: o.catalogKind as import("@/docker-shared/global-asset-library/types").GlobalAssetCatalogKind,
            title: String(o.title ?? "未命名"),
            ossUrl: String(o.ossUrl ?? ""),
            thumbUrl: typeof o.thumbUrl === "string" ? o.thumbUrl : null,
            scope: o.scope as import("@/docker-shared/global-asset-library/types").GlobalAssetCatalogScope,
            subtitle: typeof o.subtitle === "string" ? o.subtitle : null,
            description: typeof o.description === "string" ? o.description : null,
            promptOnly: o.promptOnly === true,
          };
        }),
        counts: (data.counts as Record<string, number>) ?? {},
      };
    },
    async fetchWorks(query) {
      const params = new URLSearchParams();
      if (query.kind && query.kind !== "all") params.set("kind", query.kind);
      if (query.keyword) params.set("keyword", query.keyword);
      if (query.perSource) params.set("perSource", String(query.perSource));
      const data = await bookFetch(`api/platform/v1/ai-space/assets?${params.toString()}`);
      const items = Array.isArray(data.items) ? data.items : [];
      return {
        items: items
          .map((raw) => {
            const o = raw as Record<string, unknown>;
            const resolved = o.resolved as Record<string, unknown> | undefined;
            const mediaUrl =
              typeof resolved?.mediaUrl === "string" ? resolved.mediaUrl : "";
            if (!mediaUrl) return null;
            return {
              id: String(o.key ?? o.sourceId ?? ""),
              catalogKind: "works" as const,
              title: String(resolved?.title ?? "作品"),
              ossUrl: mediaUrl,
              thumbUrl:
                typeof resolved?.thumbnailUrl === "string"
                  ? resolved.thumbnailUrl
                  : mediaUrl,
              subtitle:
                typeof resolved?.moduleLabel === "string"
                  ? resolved.moduleLabel
                  : null,
            };
          })
          .filter(Boolean) as import("@/docker-shared/global-asset-library/types").GlobalAssetPickItem[],
      };
    },
    async importToCatalog(body) {
      await bookFetch("api/sso/tools/ecom/catalog/import-from-image", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    async fetchProjectItems(query: FetchProjectItemsQuery) {
      const pid = query.projectId?.trim();
      if (!pid) return { items: [] as UnifiedAssetPickItem[] };
      const params = new URLSearchParams({ projectId: pid });
      if (query.kind?.trim()) params.set("kind", query.kind.trim());
      const data = await bookFetch(`api/canvas/project-assets?${params.toString()}`);
      const q = query.keyword?.trim().toLowerCase() ?? "";
      const items: UnifiedAssetPickItem[] = [];
      for (const raw of data.assets ?? []) {
        const kind = String(raw.kind ?? "");
        if (query.media === "image" && kind === "STORYBOARD_VIDEO") continue;
        const name = String(raw.displayName ?? "未命名");
        if (q && !name.toLowerCase().includes(q)) continue;
        const refUrl = Array.isArray(raw.refs)
          ? (raw.refs as Array<{ mediaUrl?: string }>)[0]?.mediaUrl?.trim()
          : "";
        const url = String(raw.thumbnailUrl ?? "").trim() || refUrl || "";
        if (!url && kind !== "PROMPT") continue;
        items.push({
          id: String(raw.id ?? ""),
          title: name,
          ossUrl: url,
          thumbUrl: url,
          section: "project",
          provenance: "projectAsset",
          insertMode: "projectAssetInsert",
          projectAssetKind: kind,
          displayType: kind,
        });
      }
      return { items: items.slice(0, query.limit ?? 240) };
    },
    async isPlatformAdmin() {
      try {
        const payload = await fetchCanvasToolsSessionFull().catch(() => null);
        const fromTools = adminFromToolsSessionPayload(payload);
        if (fromTools === true) return true;
        if (fromTools === false) return false;
        const data = (await bookFetch("api/canvas/viewer-session").catch(
          () => ({}),
        )) as { user?: { role?: string } | null };
        const role = (data.user?.role ?? "").trim().toUpperCase();
        return role === "ADMIN" || role === "SUPER_ADMIN";
      } catch {
        return false;
      }
    },
  };
}
