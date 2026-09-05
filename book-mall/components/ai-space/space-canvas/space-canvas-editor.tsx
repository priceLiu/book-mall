"use client";

/**
 * 作品墙自由画布编辑器
 *
 * 栅格吸附用 react-grid-layout：12 列 × 72px 行高，`resizeConfig.enabled = false`
 * 关掉自由拉伸，块尺寸只能在属性面板的五档里切换（见设计文档 §2.4）。
 * 拖拽结束后 debounce 批量存坐标；窄屏退化为只读单列（触屏拖 12 列栅格不可用）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout";

import { Button } from "@/components/ui/button";
import type { AiSpaceLibraryAsset } from "@/lib/ai-space/ai-space-asset-library";
import type {
  AiSpacePinEntry,
  AiSpacePinMediaKind,
} from "@/lib/ai-space/ai-space-pin-types";
import type {
  AiSpaceBlockDto,
  AiSpaceBlockRefInput,
  AiSpacePageDto,
} from "@/lib/ai-space/ai-space-space-types";
import type { SpacePageTemplateKey } from "@/lib/ai-space/space-blocks/page-templates";
import {
  SPACE_GRID_COLS,
  SPACE_GRID_GAP,
  SPACE_GRID_ROW_HEIGHT,
  type SpaceSizeTierKey,
} from "@/lib/ai-space/space-blocks/size-tiers";
import { SPACE_THEME_TOKENS } from "@/lib/ai-space/space-blocks/theme";
import {
  getSpaceBlockDef,
  SPACE_PAGE_MAX_BLOCKS,
  type SpaceBlockType,
} from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

import {
  AiSpaceConfirmDialog,
  type AiSpaceConfirmRequest,
} from "../ai-space-confirm-dialog";
import { SpaceAssetDrawer, SpaceWidgetPalette } from "./space-asset-drawer";
import { SpaceBlockFrame } from "./space-block-frame";
import { SpaceBlockInspector } from "./space-block-inspector";
import { SpaceCanvasView } from "./space-canvas-view";
import { SpacePageSettings } from "./space-page-settings";
import { SpaceTemplatePicker } from "./space-template-picker";
import {
  applySpaceTemplateRequest,
  createSpaceBlockRequest,
  deleteSpaceBlockRequest,
  patchSpacePage,
  saveSpaceLayoutRequest,
  setSpacePublish,
  updateSpaceBlockRequest,
} from "./space-client";

import "react-grid-layout/css/styles.css";

const LAYOUT_SAVE_DEBOUNCE_MS = 800;

/** 只放素材、没选中块时，按媒体形态新建哪种挂件 */
const DEFAULT_BLOCK_FOR_KIND: Record<AiSpacePinMediaKind, SpaceBlockType> = {
  image: "image",
  video: "video",
  audio: "audio",
};

type PanelTab = "assets" | "widgets" | "inspector";

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: "assets", label: "素材" },
  { id: "widgets", label: "挂件" },
  { id: "inspector", label: "属性" },
];

function toRefInputs(block: AiSpaceBlockDto): AiSpaceBlockRefInput[] {
  return block.refs.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    sourceApp: r.sourceApp,
    slotKey: r.slotKey || undefined,
    caption: r.caption,
  }));
}

/** 窄屏拖 12 列栅格不可用，退化为只读单列 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

export function SpaceCanvasEditor({
  initialPage,
  initialPins,
}: {
  initialPage: AiSpacePageDto;
  initialPins: AiSpacePinEntry[];
}) {
  const [page, setPage] = useState(initialPage);
  const [pins, setPins] = useState(initialPins);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("assets");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<AiSpaceConfirmRequest | null>(null);

  const narrow = useIsNarrow();
  const { width, containerRef, mounted } = useContainerWidth();
  // RGL v2 的 ref 按 React 19 类型标注（可为 null），本仓库仍是 React 18
  const gridHostRef = containerRef as React.RefObject<HTMLDivElement>;
  const saveTimer = useRef<number | null>(null);

  const theme = SPACE_THEME_TOKENS[page.theme.preset];
  const blocks = page.blocks;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const selectedDef = selected ? getSpaceBlockDef(selected.blockType) : null;

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const replaceBlock = useCallback((next: AiSpaceBlockDto) => {
    setPage((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === next.id ? next : b)),
    }));
  }, []);

  // ---------------------------------------------------------------------
  // 布局
  // ---------------------------------------------------------------------

  const rglLayout: Layout = useMemo(
    () =>
      blocks.map((b) => ({
        i: b.id,
        x: b.layoutX,
        y: b.layoutY,
        w: b.layoutW,
        h: b.layoutH,
      })),
    [blocks],
  );

  const flushLayout = useCallback(
    async (items: AiSpaceBlockDto[]) => {
      // 单列排序跟随阅读顺序（先上后左），这样窄屏降级不会乱
      const ordered = [...items].sort(
        (a, b) => a.layoutY - b.layoutY || a.layoutX - b.layoutX,
      );
      await run(() =>
        saveSpaceLayoutRequest(
          ordered.map((b, i) => ({
            id: b.id,
            layoutX: b.layoutX,
            layoutY: b.layoutY,
            layoutW: b.layoutW,
            layoutH: b.layoutH,
            mobileOrder: i,
          })),
        ),
      );
      setLayoutDirty(false);
    },
    [run],
  );

  const onLayoutChange = useCallback(
    (next: Layout) => {
      let changed = false;
      const merged = blocks.map((b) => {
        const item = next.find((n) => n.i === b.id);
        if (!item) return b;
        if (item.x === b.layoutX && item.y === b.layoutY) return b;
        changed = true;
        return { ...b, layoutX: item.x, layoutY: item.y };
      });
      if (!changed) return;

      setPage((prev) => ({ ...prev, blocks: merged }));
      setLayoutDirty(true);

      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void flushLayout(merged);
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [blocks, flushLayout],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  // ---------------------------------------------------------------------
  // 块操作
  // ---------------------------------------------------------------------

  const createBlock = useCallback(
    async (blockType: string, refs?: AiSpaceBlockRefInput[]) => {
      if (blocks.length >= SPACE_PAGE_MAX_BLOCKS) {
        setError(`单页最多 ${SPACE_PAGE_MAX_BLOCKS} 个块`);
        return;
      }
      const block = await run(() => createSpaceBlockRequest({ blockType, refs }));
      if (!block) return;
      setPage((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
      setSelectedId(block.id);
      setPanelTab("inspector");
    },
    [blocks.length, run],
  );

  /** 放素材：优先塞进选中块，否则按形态新建挂件 */
  const placeAsset = useCallback(
    async (kind: AiSpacePinMediaKind, newRef: AiSpaceBlockRefInput) => {
      if (selected && selectedDef && selectedDef.refs.max > 0) {
        const accepts =
          !selectedDef.acceptKinds || selectedDef.acceptKinds.includes(kind);
        if (accepts) {
          if (selected.refs.length >= selectedDef.refs.max) {
            setError(`「${selectedDef.label}」最多放 ${selectedDef.refs.max} 个素材`);
            return;
          }
          const next = await run(() =>
            updateSpaceBlockRequest({
              id: selected.id,
              refs: [...toRefInputs(selected), newRef],
            }),
          );
          if (next) replaceBlock(next);
          return;
        }
      }

      await createBlock(DEFAULT_BLOCK_FOR_KIND[kind], [newRef]);
    },
    [selected, selectedDef, run, replaceBlock, createBlock],
  );

  /** 素材抽屉「已收进」：来自 AiSpacePin */
  const useAsset = useCallback(
    (pin: AiSpacePinEntry) =>
      placeAsset(pin.resolved.kind, {
        sourceType: pin.sourceType,
        sourceId: pin.sourceId,
        sourceApp: pin.sourceApp,
        caption: pin.caption,
      }),
    [placeAsset],
  );

  /**
   * 素材抽屉「全部资产」：直接引用源记录，**不要求先收进空间**。
   * 块引用与 Pin 是两条独立记录，画布上放过并不会自动出现在「已收进」里。
   */
  const useLibraryAsset = useCallback(
    (asset: AiSpaceLibraryAsset) =>
      placeAsset(asset.resolved.kind, {
        sourceType: asset.sourceType,
        sourceId: asset.sourceId,
        sourceApp: asset.sourceApp,
        caption: null,
      }),
    [placeAsset],
  );

  const patchBlock = useCallback(
    async (patch: {
      sizeTier?: SpaceSizeTierKey;
      config?: Record<string, unknown>;
      content?: { text: string };
      refs?: AiSpaceBlockRefInput[];
    }) => {
      if (!selected) return;
      const next = await run(() =>
        updateSpaceBlockRequest({ id: selected.id, ...patch }),
      );
      if (next) replaceBlock(next);
    },
    [selected, run, replaceBlock],
  );

  const askDeleteBlock = useCallback(
    (block: AiSpaceBlockDto) => {
      const def = getSpaceBlockDef(block.blockType);
      setConfirmRequest({
        title: "删除这个块",
        message: (
          <>
            <p>从画布移除「{def?.label ?? block.blockType}」。</p>
            <p>
              <strong>只影响布置</strong>
              ，块里引用的素材仍保留在空间与原应用中。
            </p>
          </>
        ),
        confirmLabel: "删除",
        onConfirm: async () => {
          const ok = await run(async () => {
            await deleteSpaceBlockRequest(block.id);
            return true;
          });
          if (ok) {
            setPage((prev) => ({
              ...prev,
              blocks: prev.blocks.filter((b) => b.id !== block.id),
            }));
            setSelectedId((prev) => (prev === block.id ? null : prev));
          }
          setConfirmRequest(null);
        },
      });
    },
    [run],
  );

  const askRemovePin = useCallback(
    (pin: AiSpacePinEntry) => {
      const usedCount = blocks.reduce(
        (n, b) =>
          n +
          b.refs.filter(
            (r) => r.sourceType === pin.sourceType && r.sourceId === pin.sourceId,
          ).length,
        0,
      );
      setConfirmRequest({
        title: "移出空间",
        message: (
          <>
            <p>
              把「{pin.caption ?? pin.resolved.title ?? "该素材"}」从空间素材中移除。
            </p>
            {usedCount > 0 ? (
              <p>
                该素材当前在画布上有 <strong>{usedCount}</strong> 处引用，移出后这些位置会显示为空槽位。
              </p>
            ) : null}
            <p>原作品仍保留在来源应用中。</p>
          </>
        ),
        confirmLabel: "移出",
        onConfirm: async () => {
          const ok = await run(async () => {
            const res = await fetch(
              `/api/platform/v1/ai-space/pins?pinId=${encodeURIComponent(pin.pinId)}`,
              { method: "DELETE", credentials: "include" },
            );
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(data.error ?? "移出失败");
            }
            return true;
          });
          if (ok) setPins((prev) => prev.filter((p) => p.pinId !== pin.pinId));
          setConfirmRequest(null);
        },
      });
    },
    [blocks, run],
  );

  const askApplyTemplate = useCallback(
    (key: SpacePageTemplateKey) => {
      setConfirmRequest({
        title: "套用整页版式",
        message: (
          <>
            <p>会按新版式重排所有块的位置与尺寸档位。</p>
            <p>
              <strong>不会删除任何块</strong>
              ，多出的块追加到页面末尾；重排后无法一键撤销。
            </p>
          </>
        ),
        confirmLabel: "套用",
        onConfirm: async () => {
          const next = await run(() => applySpaceTemplateRequest(key));
          if (next) {
            setPage(next);
            setLayoutDirty(false);
          }
          setConfirmRequest(null);
          setShowTemplates(false);
        },
      });
    },
    [run],
  );

  // ---------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------

  const canvasBody =
    previewing || narrow ? (
      <SpaceCanvasView page={page} />
    ) : (
      <div ref={gridHostRef}>
        {mounted && blocks.length > 0 ? (
          <GridLayout
            width={width}
            layout={rglLayout}
            gridConfig={{
              cols: SPACE_GRID_COLS,
              rowHeight: SPACE_GRID_ROW_HEIGHT,
              margin: [SPACE_GRID_GAP, SPACE_GRID_GAP],
              containerPadding: [0, 0],
            }}
            // 只按把手拖动，否则块内滑块/播放器会变成拖拽起点
            dragConfig={{ handle: ".space-drag-handle", threshold: 4 }}
            // 自由拉伸关闭：尺寸只走五档
            resizeConfig={{ enabled: false }}
            onLayoutChange={onLayoutChange}
          >
            {blocks.map((block) => (
              <div key={block.id}>
                <SpaceBlockFrame
                  block={block}
                  selected={block.id === selectedId}
                  theme={theme}
                  accent={page.theme.accent}
                  pageTitle={page.title}
                  pageBio={page.bio}
                  onSelect={() => {
                    setSelectedId(block.id);
                    setPanelTab("inspector");
                  }}
                  onDelete={() => askDeleteBlock(block)}
                />
              </div>
            ))}
          </GridLayout>
        ) : blocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d0d7de] p-10 text-center">
            <p className="text-sm font-medium text-[#1f2328]">画布是空的</p>
            <p className="mt-1 text-sm text-[#656d76]">
              从右侧「挂件」新建块，或在「素材」里点一个作品直接放上来。
            </p>
          </div>
        ) : null}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={previewing ? "default" : "outline"}
          onClick={() => setPreviewing((v) => !v)}
        >
          {previewing ? "退出预览" : "预览"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowTemplates(true)}
        >
          整页版式
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowSettings(true)}
        >
          空间信息
        </Button>

        <span className="ml-auto text-xs text-[#8c959f]">
          {busy
            ? "保存中…"
            : layoutDirty
              ? "有未保存的位置改动"
              : page.publishStatus === "PUBLISHED"
                ? `已发布 · /space/${page.slug}`
                : "草稿（未公开）"}
        </span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {narrow && !previewing ? (
        <p className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] p-3 text-xs leading-relaxed text-[#656d76]">
          窄屏下画布以单列只读方式展示。要调整布置请用平板或电脑打开。
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div
          className="min-w-0 rounded-lg p-3"
          style={{ background: theme.canvasBg }}
          onMouseDown={(e) => {
            // 点空白处取消选中
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {canvasBody}
        </div>

        {previewing || narrow ? null : (
          <aside className="space-y-3 rounded-lg border border-[#d0d7de] bg-white p-3">
            <div className="flex gap-1">
              {PANEL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPanelTab(t.id)}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs",
                    panelTab === t.id
                      ? "bg-[#1f2328] text-white"
                      : "border border-[#d0d7de] text-[#656d76]",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {panelTab === "assets" ? (
              <SpaceAssetDrawer
                pins={pins}
                acceptKinds={selectedDef?.acceptKinds ?? null}
                selectedBlockLabel={selectedDef?.label ?? null}
                busy={busy}
                onUseAsset={useAsset}
                onUseLibraryAsset={useLibraryAsset}
                onRemovePin={askRemovePin}
              />
            ) : null}

            {panelTab === "widgets" ? (
              <SpaceWidgetPalette busy={busy} onCreate={(t) => void createBlock(t)} />
            ) : null}

            {panelTab === "inspector" ? (
              <SpaceBlockInspector
                block={selected}
                busy={busy}
                onConfigChange={(patch) =>
                  void patchBlock({ config: { ...selected?.config, ...patch } })
                }
                onContentChange={(text) => void patchBlock({ content: { text } })}
                onTierChange={(tier) => void patchBlock({ sizeTier: tier })}
                onRemoveRef={(refId) => {
                  if (!selected) return;
                  const kept = selected.refs.filter((r) => r.id !== refId);
                  void patchBlock({
                    refs: kept.map((r) => ({
                      sourceType: r.sourceType,
                      sourceId: r.sourceId,
                      sourceApp: r.sourceApp,
                      caption: r.caption,
                    })),
                  });
                }}
                onMoveRef={(refId, delta) => {
                  if (!selected) return;
                  const list = [...selected.refs];
                  const from = list.findIndex((r) => r.id === refId);
                  const to = from + delta;
                  if (from < 0 || to < 0 || to >= list.length) return;
                  [list[from], list[to]] = [list[to], list[from]];
                  void patchBlock({
                    refs: list.map((r) => ({
                      sourceType: r.sourceType,
                      sourceId: r.sourceId,
                      sourceApp: r.sourceApp,
                      caption: r.caption,
                    })),
                  });
                }}
              />
            ) : null}
          </aside>
        )}
      </div>

      {showTemplates ? (
        <SpaceTemplatePicker
          current={page.templateKey}
          busy={busy}
          onApply={askApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      ) : null}

      {showSettings ? (
        <SpacePageSettings
          page={page}
          busy={busy}
          error={error}
          onSave={async (patch) => {
            const next = await run(() => patchSpacePage(patch));
            if (next) {
              setPage(next);
              setShowSettings(false);
            }
          }}
          onPublishToggle={async (publish) => {
            const next = await run(() => setSpacePublish(publish));
            if (next) setPage(next);
          }}
          onClose={() => setShowSettings(false)}
        />
      ) : null}

      <AiSpaceConfirmDialog
        request={confirmRequest}
        busy={busy}
        onCancel={() => setConfirmRequest(null)}
      />
    </div>
  );
}
