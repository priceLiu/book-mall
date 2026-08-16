"use client";

/**
 * 「资产库」tab：跨应用全局资产的聚合浏览。
 *
 * 这里是 **只读汇聚 + 收藏 / 深链**，不做删除——删除遵循「谁建立谁删除」，
 * 必须回到原应用（见 doc/product/AI 空间功能设计文档.md §7.1）。
 */

import { useCallback, useState } from "react";

import type { AiSpaceLibraryAsset } from "@/lib/ai-space/ai-space-asset-library";

import { AiSpaceAssetDetailDialog } from "./ai-space-asset-detail-dialog";
import {
  AssetLibraryFilters,
  AssetLibraryGrid,
  useAssetLibrary,
} from "./asset-library/asset-library-browser";
import {
  pinLibraryAsset,
  unpinLibraryAsset,
} from "./asset-library/asset-library-client";

export function AiSpaceAssetLibraryDesk() {
  const library = useAssetLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);

  // 从列表现取，保证收藏状态变化后详情弹层同步
  const detail = library.items.find((i) => i.key === detailKey) ?? null;

  const togglePin = useCallback(
    async (asset: AiSpaceLibraryAsset) => {
      setBusy(true);
      setError(null);
      try {
        if (asset.pinned && asset.pinId) {
          await unpinLibraryAsset(asset.pinId);
          library.patchItem(asset.key, { pinned: false, pinId: null });
        } else {
          const pinId = await pinLibraryAsset(asset);
          library.patchItem(asset.key, { pinned: true, pinId });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      } finally {
        setBusy(false);
      }
    },
    [library],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#d0d7de] bg-[#f6f8fa] p-3">
        <p className="text-xs leading-relaxed text-[#656d76]">
          汇聚电商工具箱、AI 工具站、画布、影视项目、AI 试衣、快速复制等应用里已完成的资产。
          「收进空间」后会出现在作品墙素材抽屉的「已收进」里；作品墙的「全部资产」也能直接取材，
          无需先收藏。删除资产请回到创建它的应用。
        </p>
      </div>

      <AssetLibraryFilters state={library} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <AssetLibraryGrid
        state={library}
        columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        busy={busy}
        primaryLabel="查看详情"
        onPrimary={(a) => setDetailKey(a.key)}
        secondaryLabel={(a) => (a.pinned ? "移出空间" : "收进空间")}
        onSecondary={(a) => void togglePin(a)}
      />

      {detail ? (
        <AiSpaceAssetDetailDialog
          asset={detail}
          busy={busy}
          onTogglePin={() => void togglePin(detail)}
          onClose={() => setDetailKey(null)}
        />
      ) : null}
    </div>
  );
}
