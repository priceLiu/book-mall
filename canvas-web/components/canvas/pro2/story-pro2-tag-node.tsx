"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import type { Editor } from "@tiptap/react";
import { GripVertical, Tag } from "lucide-react";

import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { useCanvasStore } from "@/lib/canvas/store";
import { validateStoryPipelineDeletion } from "@/lib/canvas/story-pipeline-delete-guard";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import { selectPro2TagNodeDefaultLabel } from "@/lib/canvas/pro2-tag-node-label";
import { useTagRichTextCommit } from "@/lib/canvas/use-tag-rich-text-commit";
import { useDialogs } from "@/components/dialogs/dialog-provider";
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
import { ensureTagRichTextHtmlDocument, normalizeTagRichTextBody } from "@/lib/canvas/tag-rich-text-migrate";
import type { StoryPro2TagNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { cn } from "@/lib/utils";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeResizeGrip } from "./pro2-node-resize-grip";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { StoryPro2TagExpandModal } from "./story-pro2-tag-expand-modal";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
import {
  TagRichTextEditor,
} from "./tag-rich-text-editor.client";
import { TagRichTextBodyView } from "./tag-rich-text-body-view";
import { TagRichTextToolbar } from "./tag-rich-text-toolbar";

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
  const { doubleConfirm } = useDialogs();
  const removeNode = useCanvasStore((s) => s.removeNode);
  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-tag");

  const defaultLabel = useCanvasStore(
    useCallback((s) => selectPro2TagNodeDefaultLabel(s.nodes, id), [id]),
  );

  const d = data as unknown as StoryPro2TagNodeData;
  const storedBody = d.body ?? "";
  const { draft, schedule, flush, storedIsHtml } = useTagRichTextCommit(id, storedBody);
  const editorContent = useMemo(
    () =>
      storedIsHtml
        ? ensureTagRichTextHtmlDocument(draft)
        : normalizeTagRichTextBody(storedBody),
    [storedIsHtml, draft, storedBody],
  );
  const isEmpty = useMemo(() => {
    if (storedIsHtml) {
      return (
        !editorContent ||
        editorContent === "<p></p>" ||
        editorContent === "<p><br></p>"
      );
    }
    return !storedBody.trim();
  }, [storedIsHtml, editorContent, storedBody]);
  const [expandOpen, setExpandOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const compact = (height ?? 999) <= 80;
  const resizeCorner = !!selected;
  const mountEditor = soleSelected;

  const bindEditor = useCallback((ed: Editor | null) => {
    editorRef.current = ed;
    setEditor(ed);
  }, []);

  const onDeleteNode = useCallback(async () => {
    flush();
    const { nodes, edges } = useCanvasStore.getState();
    const validation = validateStoryPipelineDeletion([id], nodes, edges);
    if (!validation.ok) {
      canvasNotify({
        title: "无法删除该节点",
        message: validation.message,
        variant: "error",
      });
      return;
    }
    if (!validation.allowedIds.includes(id)) return;

    const label = d.label?.trim() || defaultLabel;
    const ok = await doubleConfirm({
      first: {
        title: `删除「${label}」？`,
        message: "将从画布移除此标签节点。",
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
    removeNode(id);
  }, [id, d.label, defaultLabel, doubleConfirm, flush, removeNode]);

  useEffect(() => {
    if (!soleSelected) flush();
  }, [soleSelected, flush]);

  useEffect(() => {
    if (!mountEditor) {
      editorRef.current = null;
      setEditor(null);
    }
  }, [mountEditor]);

  useEffect(() => {
    if (!mountEditor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const inEditor = (e.target as HTMLElement | null)?.closest(".ProseMirror");
      if (!inEditor) return;
      if (!ed.isEmpty) return;
      const { nodes, edges } = useCanvasStore.getState();
      const validation = validateStoryPipelineDeletion([id], nodes, edges);
      if (!validation.ok || !validation.allowedIds.includes(id)) return;
      e.preventDefault();
      e.stopPropagation();
      flush();
      removeNode(id);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [mountEditor, id, flush, removeNode]);

  const selectNode = useCallback(() => {
    useCanvasStore.getState().setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === id })),
    );
  }, [id]);

  const bodyPadClass = compact ? "px-2 py-1" : "px-3 py-2.5";

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {soleSelected ? (
        <LibtvNodeToolbarPortal
          nodeId={id}
          visible={soleSelected}
          toolbarHeightEstimate={100}
        >
          <TagRichTextToolbar
            editor={editor}
            onExpand={() => {
              flush();
              setExpandOpen(true);
            }}
            onDelete={() => void onDeleteNode()}
            onDuplicate={onDuplicateNode}
          />
        </LibtvNodeToolbarPortal>
      ) : null}

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <Tag className="size-3.5 shrink-0 text-violet-300/80" />
        <LibtvEditableNodeTitle
          nodeId={id}
          defaultLabel={defaultLabel}
          textClassName="text-[11px] text-white"
        />
      </div>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "relative flex min-h-0 flex-1 flex-col",
          resizeCorner ? "overflow-visible" : "overflow-hidden",
          !mountEditor && isEmpty && "cursor-text",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
        onClick={() => {
          if (!soleSelected) selectNode();
        }}
      >
        {isEmpty && !mountEditor && !compact ? <TagEmptySkeleton /> : null}

        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-y-auto",
            bodyPadClass,
            resizeCorner && "pr-6 pb-6",
            mountEditor && LIBTV_CARD_DRAG_CLASS,
          )}
        >
          {mountEditor ? (
            <TagRichTextEditor
              content={editorContent}
              editable
              placeholder="输入标注内容…"
              onUpdate={schedule}
              onBlur={flush}
              onEditor={bindEditor}
            />
          ) : !isEmpty ? (
            <TagRichTextBodyView
              storedBody={storedBody}
              htmlDraft={draft}
            />
          ) : null}
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
        title={d.label?.trim() || defaultLabel}
        value={editorContent}
        onClose={() => setExpandOpen(false)}
        onSave={(html) => flush(html)}
      />
    </div>
  );
}
