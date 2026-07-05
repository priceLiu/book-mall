"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNodes, useReactFlow } from "@xyflow/react";
import { LayoutGrid, FolderPlus, Trash2 } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { computePro2MultiSelectionBbox } from "@/lib/canvas/pro2-selection-bbox";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { validateStoryPipelineDeletion } from "@/lib/canvas/story-pipeline-delete-guard";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import { GROUP_COLOR_PRESETS, isGroupNode } from "@/lib/canvas/types";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  CanvasPillToolbar,
  CanvasToolIcon,
  CanvasToolbarBadge,
} from "./canvas-floating-toolbar";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56; // 顶部项目工具栏区域，选区浮动条勿与之重叠
const GAP = 6;

/**
 * 框选浮动工具条：
 * - 直接订阅 RF 内部 nodes（`useNodes()` + `n.selected` 过滤），不再依赖 `useOnSelectionChange`，避免漏触发
 * - bbox 用 internal.positionAbsolute（已含父组）+ measured，更准
 * - 视口 clamp：上方放不下 → 自动翻到选区下方
 * - 3 个 logo（分组 / 自动整理 / 删除）+ 已选 N chip
 */
export function SelectionToolbar() {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const createGroupContaining = useCanvasStore((s) => s.createGroupContaining);
  const autoLayoutNodes = useCanvasStore((s) => s.autoLayoutNodes);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const allNodes = useCanvasStore((s) => s.nodes);
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const { doubleConfirm, alert } = useDialogs();

  const allRfNodes = useNodes();
  const selectedIds = useMemo(
    () =>
      allRfNodes
        .filter((n) => n.selected && !isGroupNode(n.type as string))
        .map((n) => n.id),
    [allRfNodes],
  );

  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLOR_PRESETS[0]);

  // 让点击 handler 永远拿到最新选中
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    if (selectedIds.length < 2 && groupOpen) setGroupOpen(false);
  }, [selectedIds, groupOpen]);

  // bbox（绝对画布坐标）— 优先 internal-node + store 节点默认尺寸
  const bbox = useMemo(
    () => computePro2MultiSelectionBbox(selectedIds, allNodes, getInternalNode),
    [selectedIds, allNodes, getInternalNode, allRfNodes],
  );

  // 屏幕坐标 + 上 / 下 placement clamp
  const placement = useMemo(() => {
    if (!bbox) return null;
    const cx = (bbox.x + bbox.x2) / 2;
    const top = flowToScreenPosition({ x: cx, y: bbox.y });
    const bottom = flowToScreenPosition({ x: cx, y: bbox.y2 });
    // 上方放不下（会盖到 header / logo 面板）→ 翻到选区下方
    if (top.y - TOOLBAR_HEIGHT - GAP < HEADER_RESERVED) {
      return { x: bottom.x, y: bottom.y + GAP, place: "below" as const };
    }
    return { x: top.x, y: top.y - GAP, place: "above" as const };
  }, [bbox, flowToScreenPosition]);

  useEffect(() => {
    if (groupOpen && !groupName) {
      setGroupName(`分组 ${new Date().toLocaleTimeString().slice(0, 5)}`);
    }
  }, [groupOpen, groupName]);

  if (marqueeSelecting || !placement || selectedIds.length < 2) return null;

  return (
    <div
      className="pointer-events-auto fixed z-40"
      style={{
        left: placement.x,
        top: placement.y,
        transform: `translate(-50%, ${placement.place === "above" ? "-100%" : "0%"})`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!groupOpen ? (
        <CanvasPillToolbar
          badge={<CanvasToolbarBadge>已选 {selectedIds.length}</CanvasToolbarBadge>}
        >
          <CanvasToolIcon
            label="分组"
            hint={`将选中 ${selectedIds.length} 个节点装进分组`}
            onClick={() => setGroupOpen(true)}
          >
            <FolderPlus className="size-[18px]" strokeWidth={1.75} />
          </CanvasToolIcon>
          <CanvasToolIcon
            label="自动整理"
            hint="按拓扑顺序左→右排列（Dagre LR）；分组会同步收紧"
            onClick={() => autoLayoutNodes(selectedIdsRef.current)}
          >
            <LayoutGrid className="size-[18px]" strokeWidth={1.75} />
          </CanvasToolIcon>
          <CanvasToolIcon
            label="删除选中"
            hint={`删除选中的 ${selectedIds.length} 个节点（不可恢复）`}
            danger
            onClick={async () => {
              const ids = [...selectedIdsRef.current];
              if (ids.length === 0) return;
              const nodes = useCanvasStore.getState().nodes;
              const edges = useCanvasStore.getState().edges;
              const validation = validateStoryPipelineDeletion(ids, nodes, edges);
              if (!validation.ok) {
                canvasNotify({
                  title: "无法删除该节点",
                  message: validation.message,
                  variant: "error",
                });
                return;
              }
              const ok = await doubleConfirm({
                first: {
                  title: `从画布删除 ${ids.length} 个节点？`,
                  message:
                    "仅删节点本身；如需清理已生成的云端图，请去画作库 / 我的图片库逐项删除。",
                  confirmLabel: "继续",
                  danger: true,
                },
                second: {
                  title: "再次确认 · 不可恢复",
                  message: "节点删除后无法撤回，是否继续？",
                  confirmLabel: "永久删除",
                  danger: true,
                },
              });
              if (!ok) return;
              for (const id of validation.allowedIds) removeNode(id);
            }}
          >
            <Trash2 className="size-[18px]" strokeWidth={1.75} />
          </CanvasToolIcon>
        </CanvasPillToolbar>
      ) : (
        <div className="w-[260px] rounded-2xl border border-white/15 bg-[#101012]/96 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium">
            <span className="text-white/70">为分组选个边框颜色与名字</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/85">
              将装入 {selectedIds.length} 个节点
            </span>
          </div>
          <div className="mb-2 flex gap-2">
            {GROUP_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`选择颜色 ${c}`}
                className="size-6 rounded-full ring-offset-2 ring-offset-black transition-all"
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : "none",
                  boxShadow: color === c ? `0 0 0 3px ${c}66` : "none",
                }}
              />
            ))}
          </div>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="分组名"
            className="mb-2 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGroupOpen(false)}
              className="rounded-md px-3 py-1 text-[12px] text-white/70 hover:bg-white/10"
            >
              取消
            </button>
            <button
              type="button"
              onClick={async () => {
                const ids = [...selectedIdsRef.current];
                if (ids.length < 2) {
                  setGroupOpen(false);
                  return;
                }
                const measuredSizes: Record<
                  string,
                  { w: number; h: number }
                > = {};
                for (const id of ids) {
                  const internal = getInternalNode(id);
                  const w = internal?.measured?.width;
                  const h = internal?.measured?.height;
                  if (w && h) measuredSizes[id] = { w, h };
                }
                const groupId = createGroupContaining(ids, {
                  label: groupName.trim() || "未命名分组",
                  color,
                  measuredSizes,
                });
                if (!groupId) {
                  await alert({
                    title: "无法创建分组",
                    message: "请框选至少 2 个节点后再分组。",
                    variant: "warning",
                  });
                  return;
                }
                setGroupOpen(false);
                setGroupName("");
              }}
              className="rounded-md px-3 py-1 text-[12px] font-medium text-black"
              style={{ background: color }}
            >
              创建分组
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
