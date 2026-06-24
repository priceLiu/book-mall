"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  BookOpen,
  Clapperboard,
  Image as ImageIcon,
  LayoutGrid,
  Layers,
  Lock,
  Mic,
  Package,
  Palette,
  ScanFace,
  Sparkles,
  Table,
  UserCircle,
  Users,
} from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasPanelShellLoading } from "@/components/canvas/canvas-panel-shell-loading";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deleteProjectAsset,
  formatCanvasApiError,
  patchProjectAsset,
} from "@/lib/canvas-api";
import {
  PROJECT_ASSET_KIND_LABELS,
  PROJECT_ASSET_TAB_KINDS,
} from "@/lib/canvas/project-asset-kind-map";
import type { ProjectAssetKind, ProjectAssetRecord } from "@/lib/canvas/project-asset-types";
import { useProjectAssets } from "@/lib/canvas/use-project-assets";
import { usePanelInfiniteScroll } from "@/lib/canvas/use-panel-infinite-scroll";
import {
  CANVAS_PANEL_SHELL_SELECT_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import {
  PRO_ASSETS_LINK_CLASS,
  PRO_ASSETS_TAB_ACTIVE_CLASS,
  PRO_ASSETS_TAB_IDLE_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import { cn } from "@/lib/utils";
import {
  buildProjectAssetDragPayload,
  CANVAS_PROJECT_ASSET_DRAG_MIME,
  isProjectAssetCanvasInsertAvailable,
} from "@/lib/canvas/spawn-project-asset-on-canvas";
import {
  projectAssetRefSnapshots,
} from "@/lib/canvas/project-asset-preview";
import { isProjectAssetVideoUrl } from "@/lib/canvas/project-asset-preview";
import { ProjectAssetHoverPreviewLayer } from "./project-asset-hover-preview";
import { ProjectAssetGridCard } from "./project-asset-grid-card";
import { StoryMediaPreviewModal } from "./story-column-media-panel";
import { StoryProAssetImportIcon } from "./story-pro-asset-import-icon";

export type UnifiedProjectAssetTab = ProjectAssetKind | "all";

const TAB_ICONS: Partial<Record<UnifiedProjectAssetTab, React.ComponentType<{ className?: string }>>> = {
  all: LayoutGrid,
  CHARACTER: Users,
  SCENE: Package,
  PROP: Package,
  OUTLINE: BookOpen,
  STORYBOARD_SCRIPT: Table,
  AUDIO: Mic,
  STORYBOARD_IMAGE: ImageIcon,
  STORYBOARD_VIDEO: Clapperboard,
  PRIVATE_PORTRAIT: ScanFace,
  DIGITAL_HUMAN: UserCircle,
  STYLE: Palette,
  PROMPT: Sparkles,
  GROUP_BUNDLE: Layers,
};

export function UnifiedProjectAssetsView({
  projectId,
  initialTab = "all",
  compact = false,
  onInsertToCanvas,
}: {
  projectId: string | null | undefined;
  initialTab?: UnifiedProjectAssetTab;
  compact?: boolean;
  /** 画布页：拖到画布或点「插入画布」 */
  onInsertToCanvas?: (assetId: string) => void;
}) {
  const base = useBookMallBaseUrl();
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [tab, setTab] = useState<UnifiedProjectAssetTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    title: string;
    anchorRect: DOMRect;
    mimeType?: string | null;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const kindFilter = tab === "all" ? null : tab;
  const canvasInsertEnabled =
    Boolean(onInsertToCanvas) && isProjectAssetCanvasInsertAvailable();
  const { assets, loading, loadingMore, hasMore, loadMore, error, refresh } = useProjectAssets(base, {
    projectId,
    kind: kindFilter,
  });
  const loadMoreSentinelRef = usePanelInfiniteScroll({
    enabled: !loading && !search.trim(),
    hasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = assets;
    if (kindFilter) {
      list = list.filter((a) => a.kind === kindFilter);
    }
    if (kindFilter === "PRIVATE_PORTRAIT") {
      list = list.filter((a) =>
        String(a.payload?.portraitAssetUri ?? "").startsWith("asset://"),
      );
    }
    if (!q) return list;
    return list.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [assets, search, kindFilter]);

  const onDelete = async (asset: ProjectAssetRecord) => {
    if (asset.id.startsWith("legacy:")) {
      await alert({
        title: "旧版资产",
        message: "该条目来自旧版资产表，请在对应列/节点面板中管理，或运行迁移脚本。",
        variant: "info",
      });
      return;
    }
    if (
      !(await doubleConfirm({
        first: {
          title: "删除资产",
          message: `确定删除「${asset.displayName}」？`,
        },
        second: {
          title: "不可恢复",
          message:
            "删除后不可恢复，含云端存储（OSS）中的关联文件（若已复制到资产库）。",
          confirmLabel: "确认删除",
          danger: true,
        },
      }))
    ) {
      return;
    }
    setBusyId(asset.id);
    try {
      await deleteProjectAsset(base, asset.id);
      await refresh();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: formatCanvasApiError(e instanceof Error ? e.message : String(e)),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const onToggleShare = async (asset: ProjectAssetRecord) => {
    if (asset.id.startsWith("legacy:")) return;
    const next = asset.visibility === "TEAM_PUBLIC" ? "PRIVATE" : "TEAM_PUBLIC";
    setBusyId(asset.id);
    try {
      await patchProjectAsset(base, asset.id, { visibility: next });
      await refresh();
    } catch (e) {
      await alert({
        title: "更新失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const onToggleLock = async (asset: ProjectAssetRecord) => {
    if (asset.id.startsWith("legacy:")) return;
    setBusyId(asset.id);
    try {
      await patchProjectAsset(base, asset.id, { locked: !asset.locked });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className={compact ? "space-y-3" : "space-y-4"}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="搜索资产…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("min-w-[140px] flex-1", CANVAS_PANEL_SHELL_SELECT_CLASS, "py-1.5 text-xs")}
          />
          {!compact ? (
            <Link href="/guides/project-assets" className={PRO_ASSETS_LINK_CLASS}>
              资产指南
            </Link>
          ) : null}
          {!compact ? (
            <Link href="/style-library" className={PRO_ASSETS_LINK_CLASS}>
              风格库
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          <TabBtn tab={tab} id="all" label="全部" onTab={setTab} />
          {PROJECT_ASSET_TAB_KINDS.map((k) => (
            <TabBtn key={k} tab={tab} id={k} label={PROJECT_ASSET_KIND_LABELS[k]} onTab={setTab} />
          ))}
        </div>

        {loading ? (
          <CanvasPanelShellLoading />
        ) : error ? (
          <p className="text-xs text-rose-300/85">
            加载失败：{error}
            {tab === "PRIVATE_PORTRAIT"
              ? "（若本地未执行数据库迁移，请在 book-mall 运行 pnpm db:deploy）"
              : null}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-white/45">
            {tab === "PRIVATE_PORTRAIT"
              ? "暂无私域人像。在图片节点工具栏点击「私域人像入库」，成功后会自动出现在此。"
              : "暂无资产。在画布节点顶栏点击「保存为资产」入库。"}
          </p>
        ) : (
          <>
            {canvasInsertEnabled ? (
              <p className="text-[11px] text-cyan-200/70">
                悬停卡片可放大预览；拖到画布空白处继续创作，或点「插入画布」。
              </p>
            ) : (
              <p className="text-[11px] text-white/40">
                悬停卡片可放大预览快照；点击主图全屏查看。
              </p>
            )}
            <div className="grid grid-cols-3 items-start gap-x-2 gap-y-3">
              {filtered.map((asset) => (
                <ProjectAssetGridItem
                  key={asset.id}
                  asset={asset}
                  busyId={busyId}
                  canvasInsertEnabled={canvasInsertEnabled}
                  onInsertToCanvas={onInsertToCanvas}
                  onPreview={(url, title) => setPreview({ url, title })}
                  onHoverPreview={(state) => setHoverPreview(state)}
                  onHoverPreviewClear={() => setHoverPreview(null)}
                  onToggleLock={() => void onToggleLock(asset)}
                  onToggleShare={() => void onToggleShare(asset)}
                  onDelete={() => void onDelete(asset)}
                />
              ))}
            </div>
            {loadingMore ? (
              <p className="py-2 text-center text-[11px] text-white/45">加载更多…</p>
            ) : null}
            <div ref={loadMoreSentinelRef} className="h-1" aria-hidden />
          </>
        )}
      </div>
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
      <ProjectAssetHoverPreviewLayer
        state={
          hoverPreview
            ? {
                url: hoverPreview.url,
                title: hoverPreview.title,
                anchorRect: hoverPreview.anchorRect,
                isVideo: isProjectAssetVideoUrl(
                  hoverPreview.url,
                  hoverPreview.mimeType,
                ),
              }
            : null
        }
      />
    </>
  );
}

function ProjectAssetGridItem({
  asset,
  busyId,
  canvasInsertEnabled,
  onInsertToCanvas,
  onPreview,
  onHoverPreview,
  onHoverPreviewClear,
  onToggleLock,
  onToggleShare,
  onDelete,
}: {
  asset: ProjectAssetRecord;
  busyId: string | null;
  canvasInsertEnabled: boolean;
  onInsertToCanvas?: (assetId: string) => void;
  onPreview: (url: string, title: string) => void;
  onHoverPreview: (state: {
    url: string;
    title: string;
    anchorRect: DOMRect;
    mimeType?: string | null;
  }) => void;
  onHoverPreviewClear: () => void;
  onToggleLock: () => void;
  onToggleShare: () => void;
  onDelete: () => void;
}) {
  const snapshots = projectAssetRefSnapshots(asset);
  const mediaItems = snapshots.map((s) => ({
    id: s.id,
    url: s.url,
    label: s.label,
    mimeType: s.mimeType,
  }));
  const canInsert = canvasInsertEnabled && !asset.id.startsWith("legacy:");
  const cardTitle = `${PROJECT_ASSET_KIND_LABELS[asset.kind]}: ${asset.displayName}`;

  return (
    <div
      className="min-w-0"
      draggable={canInsert}
      onDragStart={(e) => {
        if (!canInsert) return;
        e.dataTransfer.setData(
          CANVAS_PROJECT_ASSET_DRAG_MIME,
          buildProjectAssetDragPayload(asset.id, asset.displayName),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <ProjectAssetGridCard
        kindLabel={PROJECT_ASSET_KIND_LABELS[asset.kind]}
        displayName={asset.displayName}
        mediaItems={mediaItems}
        canInsert={canInsert}
        insertBusy={busyId === asset.id}
        onInsert={() => onInsertToCanvas?.(asset.id)}
        onHoverMedia={(item, anchor) =>
          onHoverPreview({
            url: item.url,
            title: `${cardTitle} · ${item.label}`,
            anchorRect: anchor.getBoundingClientRect(),
            mimeType: item.mimeType,
          })
        }
        onLeaveMedia={onHoverPreviewClear}
        onPreviewMedia={(item) =>
          onPreview(item.url, `${cardTitle} · ${item.label}`)
        }
        footerMeta={
          <>
            <div className="mb-1 flex min-h-[14px] flex-wrap gap-1">
              {asset.visibility === "TEAM_PUBLIC" ? (
                <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[8px] text-emerald-200">
                  团队
                </span>
              ) : null}
              {asset.locked ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-100">
                  <Lock className="size-2" /> 锁定
                </span>
              ) : null}
              {asset.editLockUserId ? (
                <span className="rounded bg-rose-500/20 px-1 py-0.5 text-[8px] text-rose-100">
                  编辑中
                </span>
              ) : null}
            </div>
            {!asset.id.startsWith("legacy:") ? (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="text-[9px] text-white/50 hover:text-white/80"
                  disabled={busyId === asset.id}
                  onClick={onToggleLock}
                >
                  {asset.locked ? "解锁" : "锁定"}
                </button>
                <button
                  type="button"
                  className="text-[9px] text-white/50 hover:text-white/80"
                  disabled={busyId === asset.id}
                  onClick={onToggleShare}
                >
                  {asset.visibility === "TEAM_PUBLIC" ? "收回" : "共享"}
                </button>
                <button
                  type="button"
                  className="text-[9px] text-rose-300/80 hover:text-rose-200"
                  disabled={busyId === asset.id}
                  onClick={onDelete}
                >
                  删除
                </button>
              </div>
            ) : null}
          </>
        }
      />
    </div>
  );
}

function TabBtn({
  tab,
  id,
  label,
  onTab,
}: {
  tab: UnifiedProjectAssetTab;
  id: UnifiedProjectAssetTab;
  label: string;
  onTab: (t: UnifiedProjectAssetTab) => void;
}) {
  const Icon = TAB_ICONS[id];
  const active = tab === id;
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
        active ? PRO_ASSETS_TAB_ACTIVE_CLASS : PRO_ASSETS_TAB_IDLE_CLASS
      }`}
      onClick={() => onTab(id)}
    >
      {Icon ? <Icon className="size-3" /> : null}
      {label}
    </button>
  );
}

export function ProjectAssetsPanelIcon() {
  return <StoryProAssetImportIcon className="size-4 text-cyan-300" />;
}
