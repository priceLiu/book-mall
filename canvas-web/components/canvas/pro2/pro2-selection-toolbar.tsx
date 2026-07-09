"use client";

import { useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { ChevronDown, Copy, FolderPlus, LayoutGrid, Loader2, BookmarkPlus } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { CANVAS_PRIMARY_BTN_SM_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import { createProjectAsset } from "@/lib/canvas-api";
import { exportNodeToProjectAssetDraft } from "@/lib/canvas/project-asset-export";
import { useCanvasStore } from "@/lib/canvas/store";
import { notifyProjectAssetsChanged } from "@/lib/canvas/use-project-assets";
import {
  computePro2MultiSelectionBbox,
  pro2SelectedNonGroupIds,
} from "@/lib/canvas/pro2-selection-bbox";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { GROUP_COLOR_PRESETS } from "@/lib/canvas/types";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_POPOVER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2-image-node-toolbar";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56;
const GAP = 8;

const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;

function imageUrlOf(node: CanvasFlowNode): string {
  const d = node.data as { ossUrl?: string; blobUrl?: string };
  return d.ossUrl ?? d.blobUrl ?? "";
}

function isPro2ThreeView(node: CanvasFlowNode): boolean {
  return (
    node.type === "story-pro2-three-view" ||
    (node.data as { pro2MediaRole?: string }).pro2MediaRole ===
      "character-three-view"
  );
}

/**
 * 图 1 · 框选多个散节点（≥2 且非组）→ 顶部浮动工具条：
 * 保存到资产 / 创建副本 / 打组（样式与组工具条一致）。
 */
export function Pro2SelectionToolbar({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { flowToScreenPosition, getInternalNode, setNodes: rfSetNodes } =
    useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const createGroupContaining = useCanvasStore((s) => s.createGroupContaining);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const projectId = useCanvasStore((s) => s.projectId);

  const storeNodes = useCanvasStore((s) => s.nodes);
  const [saving, setSaving] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("未命名分组");
  const [groupColor, setGroupColor] = useState<string>(GROUP_COLOR_PRESETS[2]);

  const selectedIds = useMemo(
    () => pro2SelectedNonGroupIds(rfNodes),
    [rfNodes],
  );

  const selectedNodes = useMemo(
    () => rfNodes.filter((n) => selectedIds.includes(n.id)),
    [selectedIds, rfNodes],
  );
  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = selectedIds;

  const saveableThreeViews = useMemo(
    () =>
      selectedNodes
        .filter((n) => isPro2ThreeView(n) && imageUrlOf(n))
        .map((n) => {
          const d = n.data as {
            pro2RowKey?: string;
            label?: string;
          };
          return {
            characterKey: d.pro2RowKey || n.id,
            displayName: d.label?.trim() || "角色三视图",
            url: imageUrlOf(n),
          };
        }),
    [selectedNodes],
  );
  const skippedCount = useMemo(
    () => selectedNodes.filter((n) => !isPro2ThreeView(n)).length,
    [selectedNodes],
  );

  const viewport = useViewportTransformActive(
    selectedIds.length >= 2 && !viewportMoving,
  );

  const bbox = useMemo(() => {
    const pool = rfNodes.length ? rfNodes : storeNodes;
    return computePro2MultiSelectionBbox(
      selectedIds,
      pool as CanvasFlowNode[],
      getInternalNode,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, getInternalNode, rfNodes, storeNodes, viewport]);

  const placement = useMemo(() => {
    if (!bbox) return null;
    const cx = (bbox.x + bbox.x2) / 2;
    const top = flowToScreenPosition({ x: cx, y: bbox.y });
    const bottom = flowToScreenPosition({ x: cx, y: bbox.y2 });
    if (top.y - TOOLBAR_HEIGHT - GAP < HEADER_RESERVED) {
      return { x: bottom.x, y: bottom.y + GAP, place: "below" as const };
    }
    return { x: top.x, y: top.y - GAP, place: "above" as const };
  }, [bbox, flowToScreenPosition, viewport]);

  if (marqueeSelecting || viewportMoving || !placement || selectedIds.length < 2) {
    return null;
  }

  const onSaveToAssets = async () => {
    if (!saveableThreeViews.length) {
      await alert({
        title: "没有可保存的三视图",
        message:
          "请框选包含已生成图片的「三视图」节点后再保存到角色资产库（暂仅支持三视图，不裁切）。",
        variant: "info",
      });
      return;
    }
    if (!base) {
      await alert({
        title: "画布未就绪",
        message: "请稍后再试。",
        variant: "error",
      });
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    const edition = "pro2" as const;
    const threeViewNodes = selectedNodes.filter(
      (n) => isPro2ThreeView(n) && imageUrlOf(n),
    );
    for (const node of threeViewNodes) {
      const live = storeNodes.find((n) => n.id === node.id) ?? node;
      try {
        const draft = exportNodeToProjectAssetDraft(
          {
            projectId: projectId ?? "",
            edition,
            nodeId: live.id,
            nodeType: live.type ?? "story-pro2-three-view",
            data: (live.data ?? {}) as Record<string, unknown>,
          },
          "CHARACTER",
        );
        await createProjectAsset(base, {
          kind: draft.kind,
          displayName: draft.displayName,
          description: draft.description,
          thumbnailUrl: draft.thumbnailUrl,
          visibility: "PRIVATE",
          sourceProjectId: projectId ?? null,
          sourceNodeId: live.id,
          sourceEdition: edition,
          payload: draft.payload,
          refs: draft.refs,
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    notifyProjectAssetsChanged();
    setSaving(false);
    await alert({
      title: "保存完成",
      message:
        `已保存 ${ok} 张三视图到角色资产库${fail ? `，${fail} 张失败` : ""}。` +
        (skippedCount
          ? `（已跳过 ${skippedCount} 个非三视图节点）`
          : ""),
      variant: fail ? "warning" : "info",
    });
  };

  const onDuplicate = () => {
    const ids = [...selectedIdsRef.current];
    const newIds: string[] = [];
    for (const id of ids) {
      const newId = duplicateNode(id);
      if (newId) newIds.push(newId);
    }
    if (newIds.length) {
      const set = new Set(newIds);
      rfSetNodes((prev) => prev.map((n) => ({ ...n, selected: set.has(n.id) })));
    }
  };

  const onGroup = () => {
    const ids = [...selectedIdsRef.current];
    if (ids.length < 2) return;
    const measuredSizes: Record<string, { w: number; h: number }> = {};
    for (const id of ids) {
      const internal = getInternalNode(id);
      const w = internal?.measured?.width;
      const h = internal?.measured?.height;
      if (w && h) measuredSizes[id] = { w, h };
    }
    createGroupContaining(ids, {
      label: groupName.trim() || "未命名分组",
      color: groupColor,
      measuredSizes,
      pro2Styled: true,
    });
    setGroupOpen(false);
  };

  return (
    <div
      className="pointer-events-auto fixed z-[1600]"
      style={{
        left: placement.x,
        top: placement.y,
        transform: `translate(-50%, ${placement.place === "above" ? "-100%" : "0%"})`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
          "nodrag pointer-events-auto",
        )}
      >
        <span
          aria-hidden
          className="ml-0.5 size-2.5 shrink-0 rounded-full bg-white/90 nodrag pointer-events-none"
        />
        <LayoutGrid className="size-3.5 text-white/45 nodrag pointer-events-none" />
        <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />
        <button
          type="button"
          className={TOOL_BTN}
          title="保存选中的三视图到角色资产库（不裁切）"
          disabled={saving}
          onClick={() => void onSaveToAssets()}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <BookmarkPlus className="size-3.5" />
          )}
          保存到资产
        </button>
        <button
          type="button"
          className={TOOL_BTN}
          title="为选中的节点创建副本"
          onClick={onDuplicate}
        >
          <Copy className="size-3.5" />
          创建副本
        </button>
        <div className="relative">
          <button
            type="button"
            className={TOOL_BTN}
            title={`将选中 ${selectedIds.length} 个节点装进分组（设组名 / 边框色）`}
            onClick={() => setGroupOpen((v) => !v)}
          >
            <FolderPlus className="size-3.5" />
            打组
            <ChevronDown className="size-3 opacity-60" />
          </button>
          {groupOpen ? (
            <div
              className={cn(
                "absolute right-0 top-[calc(100%+8px)] z-[1] w-[240px]",
                PRO2_IMAGE_NODE_TOOLBAR_POPOVER_CLASS,
              )}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="mb-1.5 text-[11px] font-medium text-white/55">组名</p>
              <input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onGroup();
                  if (e.key === "Escape") setGroupOpen(false);
                }}
                placeholder="未命名分组"
                className="nodrag mb-2.5 w-full rounded-md border border-white/12 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder:text-white/35 focus:border-violet-400/50 focus:outline-none"
              />
              <p className="mb-1.5 text-[11px] font-medium text-white/55">
                边框颜色
              </p>
              <div className="mb-3 flex gap-2">
                {GROUP_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`颜色 ${c}`}
                    onClick={() => setGroupColor(c)}
                    className="size-6 rounded-full transition"
                    style={{
                      background: c,
                      outline:
                        groupColor === c
                          ? `2px solid ${c}`
                          : "1px solid rgba(255,255,255,0.18)",
                      boxShadow:
                        groupColor === c ? `0 0 0 3px ${c}55` : "none",
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md px-3 py-1 text-[12px] text-white/60 hover:bg-white/8"
                  onClick={() => setGroupOpen(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={CANVAS_PRIMARY_BTN_SM_CLASS}
                  onClick={onGroup}
                >
                  打组
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
