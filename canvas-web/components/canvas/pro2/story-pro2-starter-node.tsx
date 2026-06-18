"use client";

import { useCallback, useMemo, useRef } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  AlignLeft,
  AlertTriangle,
  FileText,
  FileUp,
  GripVertical,
  Loader2,
} from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasFile } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_CARD_SHELL_CLASS,
  pro2NodeBorderColor,
  PRO2_NODE_ACCENT,
  PRO2_NODE_HANDLE_CLASS,
  PRO2_TEXT_NODE_MIN_HEIGHT,
  PRO2_TEXT_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_TITLE_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_OUTER_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import {
  pro2StarterHasContent,
  pro2StarterLinkedMessage,
  pro2ThinNodeIsLinked,
  resolveLibtvThinNodeDisplayState,
} from "@/lib/canvas/pro2-thin-node-display-state";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import {
  PRO2_RIGHT_ADD_MENU,
  PRO2_STARTER_LEFT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { MarkdownView } from "@/components/canvas/markdown-view";
import type { StoryPro2StarterNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { resolvePro2TextPurpose } from "@/lib/canvas/pro2-text-purpose";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  resolveLibtvSideSpawnNodeType,
  spawnLibtvNeighborFromAnchor,
} from "@/lib/canvas/libtv-side-spawn";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  spawnPro2ScriptHubFromSource,
} from "@/lib/canvas/pro2-spawn-nodes";
import {
  parseStoryProUploadScriptFile,
  STORY_PRO_UPLOAD_SCRIPT_ACCEPT,
  formatCanvasFetchError,
} from "@/lib/canvas/story-pro-upload-script";
import { promoteEmbeddedPackFromOutline } from "@/lib/canvas/story-hub-runtime";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { cn } from "@/lib/utils";
import { Pro2ThinNodeToolbar } from "./pro2-thin-node-toolbar";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";

const TRY_UPLOAD = { id: "upload", label: "上传剧本", icon: FileUp } as const;

export function StoryPro2StarterNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const openOutlineEditor = useCanvasStore((s) => s.openPro2TextOutlineEditor);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const d = data as unknown as StoryPro2StarterNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const edges = useCanvasStore((s) => s.edges);
  const outlineMd = d.generatedOutlineMd?.trim() ?? "";
  const uploadedMd = d.uploadedScriptMd?.trim() ?? "";
  const hasOutline = Boolean(outlineMd);
  const hasUploadedScript = Boolean(uploadedMd);
  const hasCardContent = pro2StarterHasContent(d);
  const isStoryOutlineMode =
    resolvePro2TextPurpose(d, { nodeId: id, nodes, edges }) === "story-outline";
  const isGenerating =
    isStoryOutlineMode &&
    (d.themeOutlineRuntime?.status === "pending" ||
      d.themeOutlineRuntime?.status === "running");
  const outlineErrorMessage =
    isStoryOutlineMode && d.themeOutlineRuntime?.status === "error"
      ? formatCanvasTaskError(
          d.themeOutlineRuntime.failCode,
          d.themeOutlineRuntime.failMessage,
          d.modelKey,
        )
      : null;
  const isLinked = pro2ThinNodeIsLinked(id, edges);
  const displayState = resolveLibtvThinNodeDisplayState({
    hasGeneratedContent: hasCardContent,
    isGenerating,
    isLinked,
  });
  const linkedMessage = pro2StarterLinkedMessage(edges, nodes, id);
  const displayMd = useMemo(() => {
    if (uploadedMd) return uploadedMd;
    if (hasOutline) return outlineMd;
    return "";
  }, [uploadedMd, hasOutline, outlineMd]);

  const nodeLabel = useMemo(() => {
    const starters = nodes.filter((n) => n.type === "story-pro2-starter");
    const idx = starters.findIndex((n) => n.id === id);
    return `文本节点 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id]);

  const leftAddMenuSections = useMemo(
    () =>
      PRO2_STARTER_LEFT_ADD_MENU.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === "upload-script"
            ? { ...item, enabled: !hasCardContent }
            : item,
        ),
      })),
    [hasCardContent],
  );

  const openEditor = useCallback(() => {
    if (!hasCardContent || isGenerating) return;
    openOutlineEditor(id);
  }, [hasCardContent, isGenerating, id, openOutlineEditor]);

  const ingestScriptFile = useCallback(
    async (file: File) => {
      if (!base) return;
      try {
        const parsed = await parseStoryProUploadScriptFile(file);
        if (!parsed.ok) {
          await alert({
            title: "无法解析剧本",
            message: parsed.error,
            variant: "error",
          });
          return;
        }
        const blob = new Blob([parsed.md], {
          type:
            parsed.meta.format === "txt"
              ? "text/plain;charset=utf-8"
              : "text/markdown;charset=utf-8",
        });
        const uploadFile = new File([blob], parsed.meta.fileName, {
          type: blob.type,
        });
        const ossUrl = await uploadCanvasFile(base, uploadFile);
        updateNodeData(id, {
          starterMode: "upload",
          uploadedScriptMd: parsed.md,
          uploadedScriptOssUrl: ossUrl,
          uploadedScriptMeta: parsed.meta,
          generatedOutlineMd: "",
          themeInput: "",
        });
      } catch (e) {
        await alert({
          title: "上传失败",
          message: formatCanvasFetchError(e, "剧本上传云端失败"),
          variant: "error",
        });
      }
    },
    [base, id, updateNodeData, alert],
  );

  const onTryAction = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const spawnNeighbor = useCallback(
    (side: "left" | "right", nodeType?: string) => {
      if (!nodeType) return;
      const self = nodes.find((n) => n.id === id);
      if (!self) return;
      const gap = 48;
      const w = self.width ?? PRO2_TEXT_NODE_MIN_WIDTH;

      if (nodeType === "story-pro2-script-hub") {
        const outline =
          d.generatedOutlineMd?.trim() ?? d.uploadedScriptMd?.trim() ?? "";
        const promoted = promoteEmbeddedPackFromOutline(outline, "", "", "");
        spawnPro2ScriptHubFromSource({
          sourceId: id,
          sourceHandle: "text",
          position: { x: self.position.x + w + gap, y: self.position.y },
          hubData: {
            outlineMd: promoted.outlineMd,
            characterMd: promoted.characterMd,
            sceneMd: promoted.sceneMd,
            storyboardMd: promoted.storyboardMd,
            providerId: d.providerId ?? "",
            modelKey: d.modelKey ?? "",
            params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(d.params ?? {}) },
            referencedNodeIds: outline ? [id] : [],
          },
          nodes,
          edges,
          updateNodeData,
          addNode: (type, position, nodeData) =>
            addNode(type, position, nodeData),
          setEdges,
          setNodes,
        });
        return;
      }

      if (nodeType === "story-pro2-image") {
        const x =
          side === "left"
            ? self.position.x - w - gap
            : self.position.x + w + gap;
        const newId = addNode(
          "story-pro2-image",
          { x, y: self.position.y },
          buildPro2ImageNodeData(),
        );
        if (!newId) return;
        const edge =
          side === "left"
            ? {
                id: `e-${newId}-${id}`,
                source: newId,
                target: id,
                sourceHandle: "image",
                targetHandle: "in_text",
              }
            : {
                id: `e-${id}-${newId}`,
                source: id,
                target: newId,
                sourceHandle: "text",
                targetHandle: "in_image",
              };
        setEdges((prev) => [...prev, edge]);
        selectPro2NodeAfterSpawn(setNodes, newId);
        return;
      }

      if (nodeType === "story-pro2-starter") {
        const x =
          side === "left"
            ? self.position.x - w - gap
            : self.position.x + w + gap;
        const newId = addNode(
          "story-pro2-starter",
          { x, y: self.position.y },
          buildPro2StarterNodeData({
            providerId: d.providerId ?? "",
            modelKey: d.modelKey ?? "",
            params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(d.params ?? {}) },
          }),
        );
        if (!newId) return;
        if (side === "left") {
          setEdges((prev) => [
            ...prev,
            {
              id: `e-${newId}-${id}`,
              source: newId,
              target: id,
              sourceHandle: "text",
              targetHandle: "in_text",
            },
          ]);
        } else {
          setEdges((prev) => [
            ...prev,
            {
              id: `e-${id}-${newId}`,
              source: id,
              target: newId,
              sourceHandle: "text",
              targetHandle: "in_text",
            },
          ]);
        }
        selectPro2NodeAfterSpawn(setNodes, newId);
      }
    },
    [
      nodes,
      edges,
      id,
      d,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
      alert,
    ],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      if (itemId === "upload-script") {
        if (hasCardContent) return;
        fileInputRef.current?.click();
        return;
      }
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (
            spawnType === "story-pro2-three-view" ||
            spawnType === "sbv1-video-engine"
          ) {
            spawnLibtvNeighborFromAnchor(id, side, spawnType, {
              nodes,
              addNode,
              setNodes,
              setEdges,
            });
            return;
          }
          if (itemId === "script" || nodeType === "story-pro2-script-hub") {
            spawnNeighbor("right", "story-pro2-script-hub");
            return;
          }
          if (itemId === "text" || nodeType === "story-pro2-starter") {
            spawnNeighbor(side, "story-pro2-starter");
            return;
          }
          if (itemId === "image" || nodeType === "story-pro2-image") {
            spawnNeighbor(side, "story-pro2-image");
          }
        },
      );
    },
    [spawnNeighbor, alert, hasCardContent],
  );

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      data-pro2-dock-anchor={id}
    >
      <Pro2NodeResizer
        isVisible={!!selected}
        minWidth={PRO2_TEXT_NODE_MIN_WIDTH}
        minHeight={PRO2_TEXT_NODE_MIN_HEIGHT}
      />

      <Handle
        id="in_text"
        type="target"
        position={Position.Left}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          selected ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      <Handle
        id="text"
        type="source"
        position={Position.Right}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          "pointer-events-none opacity-0",
        )}
      />

      {selected ? (
        <>
          <Pro2NodeSidePlus
            side="left"
            handleId="plus_left"
            visible
            sections={leftAddMenuSections}
            onPick={onSidePick("left")}
          />
          <Pro2NodeSidePlus
            side="right"
            handleId="text"
            visible
            sections={PRO2_RIGHT_ADD_MENU}
            onPick={onSidePick("right")}
          />
        </>
      ) : null}

      {selected ? (
        <Pro2ThinNodeToolbar
          style={{ top: -60 }}
          onSaveAsAsset={() =>
            saveAsAsset(
              id,
              "story-pro2-starter",
              d as unknown as Record<string, unknown>,
              "OUTLINE",
            )
          }
        />
      ) : null}

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <FileText className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{nodeLabel}</span>
      </div>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
        style={{ borderColor: pro2NodeBorderColor(!!selected) }}
      >
        {displayState === "generated" && isGenerating ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-[12px] text-violet-200/70">
            <Loader2 className="size-5 animate-spin" />
            生成中…
          </div>
        ) : outlineErrorMessage ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <AlertTriangle className="size-8 text-red-400/70" />
            <p className="text-[11px] leading-relaxed text-red-200/85">
              {outlineErrorMessage}
            </p>
          </div>
        ) : displayState === "generated" ? (
          <div
            className="h-full min-h-0 cursor-pointer p-2"
            title={hasUploadedScript ? "已上传剧本 · 双击放大查看" : "双击放大编辑"}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openEditor();
            }}
          >
            <div className="pro2-node-scroll h-full overflow-x-auto overflow-y-auto pr-1">
              {hasUploadedScript ? (
                <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-white/75">
                  {displayMd}
                </pre>
              ) : (
                <MarkdownView
                  content={displayMd}
                  variant="darkPreview"
                  className="text-[11px]"
                />
              )}
            </div>
          </div>
        ) : displayState === "connected" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <AlignLeft className="size-8 text-white/20" />
            <p className="text-[11px] text-white/45">{linkedMessage}</p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col px-3 pb-3 pt-2">
            <div className="mb-3 flex justify-center pt-1">
              <AlignLeft className="size-8 text-white/20" />
            </div>
            <p className="mb-2 text-[11px] text-white/45">尝试：</p>
            <button
              type="button"
              className="nodrag flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-[12px] text-white/85 transition hover:bg-violet-500/12"
              onClick={() => void onTryAction()}
            >
              <TRY_UPLOAD.icon className="size-4 shrink-0 text-white/55" />
              {TRY_UPLOAD.label}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={STORY_PRO_UPLOAD_SCRIPT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void ingestScriptFile(file);
        }}
      />
    </div>
  );
}
