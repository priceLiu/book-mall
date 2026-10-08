"use client";

import type { GlobalAssetLibraryApiClient } from "@/docker-shared/global-asset-library/types";
import type { FetchProjectItemsQuery } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import type { UnifiedAssetPickItem } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { listAssets } from "@/lib/ecom-api";

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

export function createEcomGlobalAssetLibraryApi(): GlobalAssetLibraryApiClient {
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
      const data = await bookFetch(
        `api/platform/v1/global-asset-library/catalog?${params.toString()}`,
      );
      const items = Array.isArray(data.items) ? data.items : [];
      return {
        items: items.map((raw) => {
          const o = raw as Record<string, unknown>;
          return {
            id: String(o.id ?? ""),
            catalogKind: o.catalogKind as GlobalAssetLibraryApiClient extends never
              ? never
              : import("@/docker-shared/global-asset-library/types").GlobalAssetCatalogKind,
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
              subtitle: typeof resolved?.moduleLabel === "string"
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
    async fetchProjectItems(query: FetchProjectItemsQuery) {
      const modules = [
        ...(query.ecomModules ?? []),
        ...(query.ecomModule?.trim() ? [query.ecomModule.trim()] : []),
      ];
      const uniqueModules = [...new Set(modules)];
      const items: UnifiedAssetPickItem[] = [];
      const q = query.keyword?.trim().toLowerCase() ?? "";
      for (const ecomMod of uniqueModules.length ? uniqueModules : [undefined]) {
        const assets = await listAssets(ecomMod);
        for (const a of assets) {
          if (query.media === "image" && a.kind === "video") continue;
          if (query.media === "video" && a.kind !== "video") continue;
          const title = a.title?.trim() || "未命名";
          if (q && !title.toLowerCase().includes(q)) continue;
          const url = a.ossUrl?.trim() || a.thumbnailUrl?.trim() || "";
          if (!url) continue;
          items.push({
            id: a.id,
            title,
            ossUrl: url,
            thumbUrl: a.thumbnailUrl ?? url,
            section: "project",
            provenance: "ecomAsset",
            insertMode: "url",
            ecomModule: a.module,
            subtitle: a.module,
          });
        }
      }
      return { items: items.slice(0, query.limit ?? 240) };
    },
  };
}
