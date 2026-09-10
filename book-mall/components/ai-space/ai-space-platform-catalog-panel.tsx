"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  globalAssetTheme,
  resolveGlobalAssetThumbUrl,
} from "@/docker-shared/global-asset-library";
import type {
  GlobalAssetCatalogKind,
  GlobalAssetPickItem,
} from "@/docker-shared/global-asset-library";
import { createBookGlobalAssetLibraryApi } from "@/lib/global-asset-library-api";

const CATALOG_NAV: Array<{ id: GlobalAssetCatalogKind; label: string }> = [
  { id: "full-body", label: "全身模特" },
  { id: "avatar", label: "模特头像" },
  { id: "garment", label: "服装库" },
  { id: "pose", label: "姿势库" },
];

function scopeLabel(scope?: string): string {
  if (scope === "platform") return "平台";
  if (scope === "team") return "团队";
  return "我的";
}

/** AI 空间 · 资产库内「平台素材」子 Tab */
export function AiSpacePlatformCatalogPanel() {
  const api = useMemo(() => createBookGlobalAssetLibraryApi(), []);
  const theme = globalAssetTheme("light");

  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>("full-body");
  const [gender, setGender] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<GlobalAssetPickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.fetchCatalog({
        kind: catalogKind,
        gender: gender === "all" ? null : gender,
        keyword,
        limit: 120,
      });
      setItems(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, catalogKind, gender, keyword]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${theme.filterBar}`}>
        <div className={`flex rounded-full p-0.5 ${theme.segmentedTrack}`}>
          {CATALOG_NAV.map((nav) => (
            <button
              key={nav.id}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                catalogKind === nav.id ? theme.segmentedActive : theme.textSecondary
              }`}
              onClick={() => setCatalogKind(nav.id)}
            >
              {nav.label}
            </button>
          ))}
        </div>
        <select
          className={`rounded-lg border px-2 py-1 text-xs ${theme.border} bg-transparent`}
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        >
          <option value="all">全部性别</option>
          <option value="female">女</option>
          <option value="male">男</option>
        </select>
        <input
          type="search"
          placeholder="搜索…"
          className={`min-w-[140px] flex-1 rounded-lg border px-2 py-1 text-xs ${theme.border} bg-transparent`}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#86868b]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中…
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#86868b]">暂无素材</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <article
              key={item.id}
              className={`overflow-hidden rounded-xl border ${theme.border} bg-white`}
            >
              <div className="relative aspect-[3/4] bg-[#f5f5f7]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveGlobalAssetThumbUrl(item)}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-0.5 px-2 py-2">
                <p className={`truncate text-xs font-medium ${theme.textPrimary}`}>{item.title}</p>
                <p className={`truncate text-[10px] ${theme.textSecondary}`}>
                  {scopeLabel(item.scope)}
                  {item.subtitle ? ` · ${item.subtitle}` : ""}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
