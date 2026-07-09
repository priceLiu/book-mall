"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { GripVertical, Tag } from "lucide-react";

import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_CARD_SHELL_CLASS,
  pro2NodeBorderColor,
  PRO2_TAG_NODE_MIN_HEIGHT,
  PRO2_TAG_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_TITLE_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import { LIBTV_NODE_STAGE_DRAG_CLASS } from "@/components/canvas/libtv-thin-node-try-row";
import { MarkdownView } from "@/components/canvas/markdown-view";
import type { StoryPro2TagNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { cn } from "@/lib/utils";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeResizeGrip } from "./pro2-node-resize-grip";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { LibtvMarkdownFormatToolbar } from "../libtv-markdown-format-toolbar";
import { StoryPro2TagExpandModal } from "./story-pro2-tag-expand-modal";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
import { Pro2ThinNodeToolbar } from "./pro2-thin-node-toolbar";

function TagEmptySkeleton() {
  return (
    <div className="pointer-events-none flex flex-1 flex-col justify-center gap-2.5 px-4 py-3">
      <div className="h-2 w-[88%] rounded bg-white/[0.07]" />
      <div className="h-2 w-full rounded bg-white/[0.07]" />
      <div className="h-2 w-[72%] rounded bg-white/[0.07]" />
      <div className="h-2 w-[94%] rounded bg-white/[0.07]" />
    </div>
  );
}

export function StoryPro2TagNode({ id, data, selected, height }: NodeProps) {
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-tag");

  const d = data as unknown as StoryPro2TagNodeData;
  const body = d.body?.trim() ?? "";
  const hasBody = Boolean(body);
  const [editing, setEditing] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const compact = (height ?? 999) <= 80;
  /** 选中即可拉伸；编辑/非编辑均保留右下角热区 */
  const resizeCorner = !!selected;

  const nodeLabel = useMemo(() => {
    const tags = nodes.filter((n) => n.type === "story-pro2-tag");
    const idx = tags.findIndex((n) => n.id === id);
    return `标签节点 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id]);

  const setBody = useCallback(
    (next: string) => {
      updateNodeData(id, { body: next });
    },
    [id, updateNodeData],
  );

  const focusEditor = useCallback(() => {
    setEditing(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => taRef.current?.focus());
    });
  }, []);

  const bodyPadClass = compact ? "px-2 py-1" : "px-3 py-2.5";

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {soleSelected ? (
        <LibtvNodeToolbarPortal nodeId={id} visible={soleSelected}>
          <div className="flex flex-col items-center gap-2">
            <LibtvMarkdownFormatToolbar
              textareaRef={taRef}
              value={d.body ?? ""}
              onChange={setBody}
              onExpand={() => setExpandOpen(true)}
            />
            <Pro2ThinNodeToolbar onDuplicateNode={onDuplicateNode} />
          </div>
        </LibtvNodeToolbarPortal>
      ) : null}

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <Tag className="size-3.5 shrink-0 text-violet-300/80" />
        <LibtvEditableNodeTitle
          nodeId={id}
          defaultLabel={nodeLabel}
          textClassName="text-[11px] text-white"
        />
      </div>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "relative flex min-h-0 flex-1 flex-col",
          resizeCorner ? "overflow-visible" : "overflow-hidden",
          !editing && !hasBody && "cursor-text",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
        onClick={() => {
          if (!editing) focusEditor();
        }}
      >
        {!hasBody && !editing && !compact ? <TagEmptySkeleton /> : null}

        <div
          className={cn(
            "relative min-h-0 flex-1",
            resizeCorner ? "overflow-visible" : "overflow-hidden",
            editing && LIBTV_CARD_DRAG_CLASS,
          )}
        >
          {/* 所见即所得：预览层始终渲染 Markdown */}
          <div
            className={cn(
              "absolute overflow-y-auto text-[11px] leading-relaxed",
              bodyPadClass,
              !editing && LIBTV_NODE_STAGE_DRAG_CLASS,
              editing && "pointer-events-none select-none",
            )}
            style={{
              top: 0,
              left: 0,
              right: resizeCorner ? 24 : 0,
              bottom: resizeCorner ? 24 : 0,
            }}
            title={editing ? undefined : "点击编辑"}
            onDoubleClick={(e) => {
              if (editing) return;
              e.stopPropagation();
              focusEditor();
            }}
          >
            {hasBody || editing ? (
              hasBody ? (
                <MarkdownView
                  content={d.body ?? ""}
                  variant="darkPreview"
                  inheritFontSize
                />
              ) : (
                <p className="text-white/30">输入内容…</p>
              )
            ) : null}
          </div>

          {/* 编辑：不可见 textarea 捕获输入，视觉仅 Markdown 预览 */}
          {(editing || !hasBody) && (
            <textarea
              ref={taRef}
              className={cn(
                "nodrag absolute z-[1] resize-none border-0 bg-transparent font-sans text-[11px] leading-relaxed",
                "opacity-0 caret-violet-300/90",
                compact
                  ? resizeCorner
                    ? "left-2 right-6 top-1 bottom-6"
                    : "left-2 right-2 top-1 bottom-2"
                  : resizeCorner
                    ? "left-3 right-6 top-2.5 bottom-6"
                    : "left-3 right-3 top-2.5 bottom-2.5",
                !hasBody && !editing && "pointer-events-none",
              )}
              rows={compact ? 1 : undefined}
              value={d.body ?? ""}
              placeholder=""
              spellCheck={false}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setEditing(true)}
              onBlur={() => setEditing(false)}
            />
          )}
        </div>

        {resizeCorner ? (
          <>
            <Pro2NodeResizer
              isVisible
              minWidth={PRO2_TAG_NODE_MIN_WIDTH}
              minHeight={PRO2_TAG_NODE_MIN_HEIGHT}
            />
            <Pro2NodeResizeGrip
              className="!bottom-1 !right-1 !z-[101]"
              style={{ width: 20, height: 20 }}
            />
          </>
        ) : null}
      </div>

      <StoryPro2TagExpandModal
        open={expandOpen}
        title={nodeLabel}
        value={d.body ?? ""}
        onClose={() => setExpandOpen(false)}
        onSave={setBody}
      />
    </div>
  );
}
