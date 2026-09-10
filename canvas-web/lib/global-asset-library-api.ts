"use client";

import type { GlobalAssetLibraryApiClient } from "@/docker-shared/global-asset-library/types";

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
    async isPlatformAdmin() {
      try {
        const data = await bookFetch("api/sso/tools/session");
        const intro = data.introspect as Record<string, unknown> | undefined;
        return intro?.tools_role === "admin" || intro?.tier === "admin";
      } catch {
        return false;
      }
    },
  };
}
