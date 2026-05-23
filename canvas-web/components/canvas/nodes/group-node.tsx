"use client";

import { useMemo, useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { LayoutGrid, Palette, Trash2 } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  GROUP_COLOR_PRESETS,
  type GroupNodeData,
} from "@/lib/canvas/types";

/** 组容器节点：透明背景、彩色边框；hover 出现 3 个 logo（修改 / 整理 / 解散） */
export function GroupNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const ungroup = useCanvasStore((s) => s.ungroup);
  const autoLayoutNodes = useCanvasStore((s) => s.autoLayoutNodes);
  const allNodes = useCanvasStore((s) => s.nodes);

  const [editOpen, setEditOpen] = useState(false);

  const d = data as unknown as GroupNodeData;
  const color = d.color || GROUP_COLOR_PRESETS[0];

  const childrenIds = useMemo(
    () =>
      allNodes
        .filter((n) => n.parentId === id && n.type !== "group")
        .map((n) => n.id),
    [allNodes, id],
  );

  return (
    <div
      className="canvas-group-node group/gn relative h-full w-full rounded-2xl"
      style={{
        background: "transparent",
        border: `2px ${selected ? "solid" : "dashed"} ${color}`,
        boxShadow: selected ? `0 0 0 2px ${color}33` : "none",
      }}
    >
      <NodeResizer
        color={color}
        minWidth={220}
        minHeight={140}
        isVisible={selected}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color, border: "none", width: 8, height: 8 }}
      />

      {/* 标题条：背景全透明；右侧 3 个 logo 仅 hover 时出现 */}
      <div className="flex h-8 items-center justify-between gap-2 rounded-t-[14px] px-2 text-[12px] font-medium text-white">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <input
          value={d.label ?? ""}
          onChange={(e) => updateNodeData(id, { label: e.target.value })}
          placeholder="未命名分组"
          className="nodrag flex-1 bg-transparent text-white/95 outline-none placeholder:text-white/40"
          spellCheck={false}
        />

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/gn:opacity-100 focus-within:opacity-100">
          <GroupIconButton
            label="修改分组"
            hint="改颜色 / 改名"
            onClick={() => setEditOpen((v) => !v)}
            active={editOpen}
          >
            <Palette className="size-3.5" />
          </GroupIconButton>
          <GroupIconButton
            label="自动整理"
            hint={`按拓扑顺序整理本组 ${childrenIds.length} 个子节点`}
            onClick={() => autoLayoutNodes(childrenIds)}
            disabled={childrenIds.length < 2}
          >
            <LayoutGrid className="size-3.5" />
          </GroupIconButton>
          <GroupIconButton
            label="解散分组"
            hint="保留子节点、移除分组容器"
            danger
            onClick={() => ungroup(id)}
          >
            <Trash2 className="size-3.5" />
          </GroupIconButton>
        </div>
      </div>

      {/* 修改分组的小气泡（颜色 / 改名） */}
      {editOpen ? (
        <div
          className="nodrag absolute right-2 top-9 z-20 w-[220px] rounded-xl border border-white/15 bg-black/95 p-2.5 shadow-2xl backdrop-blur-md"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 text-[11px] font-medium text-white/70">分组颜色</div>
          <div className="mb-2 flex gap-2">
            {GROUP_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`选择颜色 ${c}`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(id, { color: c });
                }}
                className="size-5 rounded-full transition"
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : "1px solid rgba(255,255,255,0.18)",
                  boxShadow: color === c ? `0 0 0 3px ${c}55` : "none",
                }}
              />
            ))}
          </div>
          <div className="mb-1.5 text-[11px] font-medium text-white/70">分组名</div>
          <input
            value={d.label ?? ""}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            placeholder="未命名分组"
            className="nodrag w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[12px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-md px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
            >
              完成
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupIconButton({
  children,
  label,
  hint,
  onClick,
  danger,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={`${label} — ${hint}`}
      aria-label={`${label} — ${hint}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={`nodrag relative flex size-6 items-center justify-center rounded-md transition ${
        disabled
          ? "cursor-not-allowed text-white/30"
          : danger
            ? "text-white/75 hover:bg-red-500/20 hover:text-red-200"
            : active
              ? "bg-white/10 text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
