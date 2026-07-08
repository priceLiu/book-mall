"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { useStore } from "@xyflow/react";
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
import {
  libtvNodeScreenFontToFlowPx,
  TAG_NODE_BODY_FONT_SCREEN_PX,
} from "@/lib/canvas/libtv-node-content-font";

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
  const zoom = useStore((s) => s.transform[2]);
  const bodyFontFlowPx = libtvNodeScreenFontToFlowPx(
    TAG_NODE_BODY_FONT_SCREEN_PX,
    zoom,
  );
  const bodyTextStyle = useMemo(
    () => ({
      fontSize: bodyFontFlowPx,
      lineHeight: 1.65,
    }),
    [bodyFontFlowPx],
  );
  const compact = (height ?? 999) <= 80;

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
    requestAnimationFrame(() => taRef.current?.focus());
  }, []);

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Pro2NodeResizer
        isVisible={!!selected}
        minWidth={PRO2_TAG_NODE_MIN_WIDTH}
        minHeight={PRO2_TAG_NODE_MIN_HEIGHT}
      />
      {selected ? <Pro2NodeResizeGrip /> : null}

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
          "relative flex min-h-0 flex-1 flex-col overflow-hidden",
          !editing && !hasBody && "cursor-text",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("textarea")) return;
          if (!editing) focusEditor();
        }}
      >
        {!hasBody && !editing && !compact ? <TagEmptySkeleton /> : null}

        {editing || !hasBody ? (
          <textarea
            ref={taRef}
            className={cn(
              "nodrag h-full min-h-0 w-full flex-1 resize-none bg-transparent",
              "font-sans text-white/85",
              compact ? "px-2 py-1" : "px-3 py-2.5",
              "placeholder:text-white/30 focus:outline-none",
              !hasBody && !editing && "absolute inset-0 opacity-0",
            )}
            style={bodyTextStyle}
            rows={compact ? 1 : undefined}
            value={d.body ?? ""}
            placeholder="输入内容…"
            spellCheck={false}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
          />
        ) : (
          <div
            className="nodrag h-full min-h-0 overflow-y-auto px-3 py-2.5"
            style={bodyTextStyle}
            onDoubleClick={(e) => {
              e.stopPropagation();
              focusEditor();
            }}
          >
            <MarkdownView
              content={body}
              variant="darkPreview"
              inheritFontSize
            />
          </div>
        )}
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
