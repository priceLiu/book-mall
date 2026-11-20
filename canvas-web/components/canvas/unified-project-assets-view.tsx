"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useDeferredValue } from "react";
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
import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";
import { CanvasPanelShellLoading } from "@/components/canvas/canvas-panel-shell-loading";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deleteProjectAsset,
  formatCanvasApiError,
  patchProjectAsset,
} from "@/lib/canvas-api";
import {
  PROJECT_ASSET_KIND_LABELS,
  PROJECT_ASSET_TAB_ROW1,
  PROJECT_ASSET_TAB_ROW2,
} from "@/lib/canvas/project-asset-kind-map";
import type { ProjectAssetKind, ProjectAssetRecord } from "@/lib/canvas/project-asset-types";
import { useProjectAssets } from "@/lib/canvas/use-project-assets";
import { usePanelInfiniteScroll } from "@/lib/canvas/use-panel-infinite-scroll";
import { CANVAS_PANEL_SHELL_SELECT_CLASS } from "@/lib/canvas/canvas-chrome-semantics";

/** Hub 全页：无描边输入，减少叠框 */
const HUB_ASSETS_SEARCH_CLASS =
  "nodrag min-w-[140px] flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-white/35 focus:bg-white/[0.06] focus:outline-none";
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
  projectAssetHeroUrl,
  projectAssetRefSnapshots,
  isProjectAssetVideoUrl,
} from "@/lib/canvas/project-asset-preview";
import { PROJECT_ASSETS_FULL_PAGE_SIZE } from "@/lib/canvas/project-assets-pagination";
import { styleLibraryGridClass } from "@/lib/canvas/style-library-card-chrome";
import { ProjectAssetHoverPreviewLayer } from "./project-asset-hover-preview";
import { ProjectAssetMediaCard } from "./project-asset-media-card";
import type { ProjectAssetGalleryItem } from "./project-asset-media-card";
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
  scrollPaginate = false,
  onInsertToCanvas,
}: {
  projectId: string | null | undefined;
  initialTab?: UnifiedProjectAssetTab;
  compact?: boolean;
  /** /assets 全页：小页 + 滚动追加 + 跳过 legacy 全量合并 */
  scrollPaginate?: boolean;
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
  const debouncedSearch = useDeferredValue(search.trim());

  const kindFilter = tab === "all" ? null : tab;
  const canvasInsertEnabled =
    Boolean(onInsertToCanvas) && isProjectAssetCanvasInsertAvailable();
  const { assets, loading, loadingMore, hasMore, loadMore, error, refresh } = useProjectAssets(base, {
    projectId,
    kind: kindFilter,
    scrollPaginate,
    pageSize: scrollPaginate ? PROJECT_ASSETS_FULL_PAGE_SIZE : undefined,
    search: scrollPaginate ? debouncedSearch : undefined,
    scope: scrollPaginate && projectId ? "project" : "all",
  });
  const loadMoreSentinelRef = usePanelInfiniteScroll({
    enabled: !loading,
    hasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
    rootMargin: scrollPaginate ? "480px" : undefined,
  });

  const filtered = useMemo(() => {
    const q = scrollPaginate ? "" : search.trim().toLowerCase();
    let list = assets;
    if (!scrollPaginate && kindFilter) {
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
  }, [assets, search, kindFilter, scrollPaginate]);

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

  const onPromoteToUserSpace = async (asset: ProjectAssetRecord) => {
    if (asset.id.startsWith("legacy:") || !asset.sourceProjectId) return;
    if (
      !(await confirm({
        title: "全画布可用",
        message: `将「${asset.displayName}」设为「我的空间可用」？之后本人所有画布均可插入。`,
      }))
    ) {
      return;
    }
    setBusyId(asset.id);
    try {
      await patchProjectAsset(base, asset.id, { sourceProjectId: null });
      await refresh();
      await alert({
        title: "已更新",
        message: "该资产已在所有画布的项目资产面板中可见。",
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "更新失败",
        message: formatCanvasApiError(e instanceof Error ? e.message : String(e)),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const hubNeutralChrome = scrollPaginate && !compact;
  const tabChromeClass = cn(
    "space-y-2",
    compact
      ? "sticky top-0 z-10 -mx-3 border-b border-white/10 bg-[var(--canvas-surface)] px-3 pb-2"
      : hubNeutralChrome
        ? "sticky top-0 z-10 -mx-1 space-y-3 bg-[var(--canvas-page-bg,var(--canvas-surface))] pb-4 pt-0"
        : "sticky top-0 z-10 -mx-1 border-b border-white/10 bg-cyan-950/95 px-1 pb-3 backdrop-blur-sm",
  );

  return (
    <>
      <div className={compact ? "flex min-h-0 flex-col" : hubNeutralChrome ? "" : "space-y-4"}>
        <div className={tabChromeClass}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="搜索资产…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "min-w-[140px] flex-1 py-1.5 text-xs",
                hubNeutralChrome ? HUB_ASSETS_SEARCH_CLASS : CANVAS_PANEL_SHELL_SELECT_CLASS,
              )}
            />
            {!compact ? (
              <Link
                href="/guides/project-assets"
                className={
                  hubNeutralChrome
                    ? "shrink-0 rounded-md px-2 py-1.5 text-[11px] text-[var(--canvas-muted)] transition hover:bg-white/5 hover:text-white"
                    : PRO_ASSETS_LINK_CLASS
                }
              >
                资产指南
              </Link>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1">
            <TabBtn tab={tab} id="all" label="全部" neutralChrome={hubNeutralChrome} onTab={setTab} />
            {PROJECT_ASSET_TAB_ROW1.map((k) => (
              <TabBtn
                key={k}
                tab={tab}
                id={k}
                label={PROJECT_ASSET_KIND_LABELS[k]}
                neutralChrome={hubNeutralChrome}
                onTab={setTab}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {PROJECT_ASSET_TAB_ROW2.map((k) => (
              <TabBtn
                key={k}
                tab={tab}
                id={k}
                label={PROJECT_ASSET_KIND_LABELS[k]}
                neutralChrome={hubNeutralChrome}
                onTab={setTab}
              />
            ))}
          </div>
        </div>

        <div className={compact ? "min-h-0 flex-1 pt-2" : hubNeutralChrome ? "" : "pt-1"}>
        {loading && assets.length === 0 ? (
          scrollPaginate ? (
            <CanvasListSkeleton sections={1} cardsPerSection={12} />
          ) : (
            <CanvasPanelShellLoading />
          )
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
              : "暂无资产。在画布节点顶栏点击「保存项目资产」入库。"}
          </p>
        ) : (
          <>
            {canvasInsertEnabled ? (
              <p className="text-[11px] text-white/40">
                悬停预览区可放大预览；拖到画布空白处继续创作，或悬停点插入图标。
              </p>
            ) : scrollPaginate ? null : (
              <p className="text-[11px] text-white/40">
                悬停卡片可放大预览快照；点击主图全屏查看。
              </p>
            )}
            <div className={styleLibraryGridClass(compact)}>
              {filtered.map((asset) => (
                <ProjectAssetGridItem
                  key={asset.id}
                  asset={asset}
                  busyId={busyId}
                  canvasInsertEnabled={canvasInsertEnabled}
                  previewViaActionOnly={scrollPaginate}
                  onInsertToCanvas={onInsertToCanvas}
                  onPreview={(url, title) => setPreview({ url, title })}
                  onHoverPreview={(state) => setHoverPreview(state)}
                  onHoverPreviewClear={() => setHoverPreview(null)}
                  onToggleLock={() => void onToggleLock(asset)}
                  onToggleShare={() => void onToggleShare(asset)}
                  onPromoteToUserSpace={() => void onPromoteToUserSpace(asset)}
                  onDelete={() => void onDelete(asset)}
                />
              ))}
            </div>
            {loadingMore ? (
              <p className="py-3 text-center text-[11px] text-white/45">加载更多…</p>
            ) : hasMore && scrollPaginate ? (
              <p className="py-3 text-center text-[11px] text-white/35">
                向下滚动自动加载下一页
              </p>
            ) : null}
            <div
              ref={loadMoreSentinelRef}
              className={scrollPaginate ? "h-8" : "h-1"}
              aria-hidden
            />
          </>
        )}
        </div>
      </div>
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
      {!scrollPaginate ? (
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
      ) : null}
    </>
  );
}

function HubAssetMetaLine({ asset }: { asset: ProjectAssetRecord }) {
  const parts: string[] = [];
  if (asset.sourceProjectId && asset.visibility === "PRIVATE") {
    parts.push("本项目");
  } else if (!asset.sourceProjectId && asset.visibility === "PRIVATE") {
    parts.push("我的·全账号");
  } else if (!asset.sourceProjectId && asset.visibility === "TEAM_PUBLIC") {
    parts.push("租户库");
  }
  if (asset.visibility === "TEAM_PUBLIC") parts.push("团队");
  if (asset.locked) parts.push("锁定");
  if (asset.editLockUserId) parts.push("编辑中");
  if (!parts.length) return null;
  return (
    <p className="mt-2 text-[10px] leading-snug text-white/40">
      {parts.join(" · ")}
    </p>
  );
}

function ProjectAssetGridItem({
  asset,
  busyId,
  canvasInsertEnabled,
  previewViaActionOnly = false,
  onInsertToCanvas,
  onPreview,
  onHoverPreview,
  onHoverPreviewClear,
  onToggleLock,
  onToggleShare,
  onPromoteToUserSpace,
  onDelete,
}: {
  asset: ProjectAssetRecord;
  busyId: string | null;
  canvasInsertEnabled: boolean;
  previewViaActionOnly?: boolean;
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
  onPromoteToUserSpace: () => void;
  onDelete: () => void;
}) {
  const snapshots = projectAssetRefSnapshots(asset);
  const galleryItems: ProjectAssetGalleryItem[] = snapshots.map((s) => ({
    id: s.id,
    url: s.url,
    label: s.label,
    mimeType: s.mimeType,
  }));
  const heroUrl = projectAssetHeroUrl(asset);
  const heroMime = galleryItems[0]?.mimeType;
  const useGallery = galleryItems.length >= 2;
  const canInsert = canvasInsertEnabled && !asset.id.startsWith("legacy:");
  const kindLabel = PROJECT_ASSET_KIND_LABELS[asset.kind];
  const title = asset.displayName;
  const subtitle = kindLabel;

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
      <ProjectAssetMediaCard
        compact={false}
        title={title}
        subtitle={subtitle}
        imageUrl={useGallery ? undefined : heroUrl}
        imageAlt={title}
        previewMimeType={heroMime}
        galleryItems={useGallery ? galleryItems : undefined}
        previewViaActionOnly={previewViaActionOnly}
        seamlessGallery={previewViaActionOnly}
        enableHoverZoom={!previewViaActionOnly}
        onHoverPreviewShow={
          previewViaActionOnly
            ? undefined
            : ({ url, title: t, anchor, mimeType }) =>
                onHoverPreview({
                  url,
                  title: t,
                  anchorRect: anchor.getBoundingClientRect(),
                  mimeType,
                })
        }
        onHoverPreviewHide={previewViaActionOnly ? undefined : onHoverPreviewClear}
        onPreviewHero={
          heroUrl
            ? () => onPreview(heroUrl, `${kindLabel}: ${title}`)
            : undefined
        }
        onPreviewGalleryItem={(url, label) =>
          onPreview(url, `${kindLabel}: ${title} · ${label}`)
        }
        canInsert={canInsert}
        insertBusy={busyId === asset.id}
        onInsert={() => onInsertToCanvas?.(asset.id)}
        locked={asset.locked}
        busy={busyId === asset.id}
        onToggleLock={
          asset.id.startsWith("legacy:") ? undefined : onToggleLock
        }
        footer={
          <>
            {previewViaActionOnly ? (
              <HubAssetMetaLine asset={asset} />
            ) : (
              <div className="mb-1 mt-2 flex min-h-[14px] flex-wrap gap-1">
                {asset.sourceProjectId && asset.visibility === "PRIVATE" ? (
                  <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/65">
                    本项目
                  </span>
                ) : null}
                {!asset.sourceProjectId && asset.visibility === "PRIVATE" ? (
                  <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/65">
                    我的·全账号
                  </span>
                ) : null}
                {!asset.sourceProjectId && asset.visibility === "TEAM_PUBLIC" ? (
                  <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/65">
                    租户库
                  </span>
                ) : null}
                {asset.visibility === "TEAM_PUBLIC" ? (
                  <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/65">
                    团队
                  </span>
                ) : null}
                {asset.locked ? (
                  <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/65">
                    <Lock className="size-2" /> 锁定
                  </span>
                ) : null}
                {asset.editLockUserId ? (
                  <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-white/65">
                    编辑中
                  </span>
                ) : null}
              </div>
            )}
            {!asset.id.startsWith("legacy:") ? (
              <div
                className={cn(
                  "flex flex-wrap gap-x-2 gap-y-0.5",
                  previewViaActionOnly ? "mt-2" : "gap-1.5",
                )}
              >
                {asset.sourceProjectId ? (
                  <button
                    type="button"
                    className="text-[9px] text-white/50 hover:text-white/80"
                    disabled={busyId === asset.id}
                    onClick={onPromoteToUserSpace}
                  >
                    全画布
                  </button>
                ) : null}
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
                  className="text-[9px] text-white/50 hover:text-red-300/90"
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
  neutralChrome = false,
  onTab,
}: {
  tab: UnifiedProjectAssetTab;
  id: UnifiedProjectAssetTab;
  label: string;
  neutralChrome?: boolean;
  onTab: (t: UnifiedProjectAssetTab) => void;
}) {
  const Icon = TAB_ICONS[id];
  const active = tab === id;
  const activeClass = neutralChrome
    ? "bg-[var(--canvas-accent)]/20 text-white"
    : PRO_ASSETS_TAB_ACTIVE_CLASS;
  const idleClass = neutralChrome
    ? "text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
    : PRO_ASSETS_TAB_IDLE_CLASS;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition",
        active ? activeClass : idleClass,
      )}
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
