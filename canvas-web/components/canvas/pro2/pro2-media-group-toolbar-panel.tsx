"use client";

import {
  BookmarkPlus,
  Columns3,
  Copy,
  Download,
  LayoutGrid,
  Loader2,
  Palette,
  RotateCw,
  Rows3,
  Share2,
  Unlink,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { extractGroupSubgraph } from "@/lib/canvas/extract-group-subgraph";
import { shareWorkflowAsTemplate } from "@/lib/canvas/share-workflow";
import { useCanvasStore } from "@/lib/canvas/store";
import { CANVAS_PRIMARY_BTN_SM_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import { useSaveGroupAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { batchRunStoryRows } from "@/lib/canvas/batch-run-nodes";
import { kickoffPro2VideoBoardFromFrameGroup } from "@/lib/canvas/pro2-script-hub-helpers";
import { resolvePro2VideoBatchVideoForHub } from "@/lib/canvas/pro2-video-batch-video";
import {
  batchRunPro2SceneImageNodes,
  readPro2SceneRowsForHub,
} from "@/lib/canvas/pro2-spawn-scene-image-group";
import { formatCharacterRowThreeViewPrompt } from "@/lib/canvas/three-view-prompt-rules";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
  StoryProVideoRow,
} from "@/lib/canvas/story-pro2-workspace-types";
import { GROUP_COLOR_PRESETS } from "@/lib/canvas/types";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_POPOVER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2-image-node-toolbar";
import {
  Pro2VideoGeneratePicker,
  type Pro2VideoGenerateResult,
} from "./pro2-video-generate-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";

export type Pro2MediaGroupKind =
  | "character-board"
  | "frame-board"
  | "scene-board"
  | "video-board";

export type Pro2MediaGroupToolbarPanelProps = {
  groupId: string;
  kind: Pro2MediaGroupKind | null;
  /** 分镜视频 1.0 媒体组：批量下载 / 重排等行为与 Pro2 壳层一致 */
  edition?: "pro2" | "sbv1";
  /** sbv1 · 参考图与视频合成重新纳入组框 */
  onRelayout?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** 与图片节点顶栏一致：空白区可拖组，仅按钮 nodrag */
  passNodeDrag?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
};

function readRows<T>(node: { data?: unknown } | undefined): T[] {
  if (!node?.data || typeof node.data !== "object") return [];
  return ((node.data as { rows?: T[] }).rows ?? []) as T[];
}

function imageUrlOf(node: CanvasFlowNode): string {
  const d = node.data as { ossUrl?: string; blobUrl?: string };
  return d.ossUrl ?? d.blobUrl ?? "";
}

function videoUrlOf(node: CanvasFlowNode): string {
  const d = node.data as {
    runtime?: { ossUrl?: string; ephemeralUrl?: string };
  };
  return d.runtime?.ossUrl ?? d.runtime?.ephemeralUrl ?? "";
}

async function downloadOne(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    // 跨域兜底：直接开新标签
    window.open(url, "_blank", "noopener");
  }
}

function sanitizeDownloadFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim().slice(0, 80) || "media";
}

function downloadExt(url: string, fallback: string): string {
  const path = url.split("?")[0] ?? "";
  const ext = path.split(".").pop();
  if (!ext || ext.length > 5) return fallback;
  return ext;
}

const BATCH_DOWNLOAD_GAP_MS = 450;
/** 浏览器连续自动下载上限 · 超出需用户再次确认以续传 */
const BATCH_DOWNLOAD_CHUNK = 4;

/** Pro2 媒体组 · 顶部浮动工具条（角色三视图 / 分镜图 / 手动组 统一） */
export function Pro2MediaGroupToolbarPanel({
  groupId,
  kind,
  edition = "pro2",
  onRelayout,
  className,
  style,
  passNodeDrag = true,
  onMouseDown,
}: Pro2MediaGroupToolbarPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const ungroup = useCanvasStore((s) => s.ungroup);
  const autoLayoutNodes = useCanvasStore((s) => s.autoLayoutNodes);
  const duplicateMediaGroup = useCanvasStore((s) => s.duplicateMediaGroup);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const group = nodes.find((n) => n.id === groupId);
  const childrenIds = useMemo(
    () =>
      nodes
        .filter((n) => n.parentId === groupId && n.type !== "group")
        .map((n) => n.id),
    [nodes, groupId],
  );
  const saveGroupAsAsset = useSaveGroupAsAsset();
  const { confirm, prompt, alert } = useDialogs();
  const base = useBookMallBaseUrl();
  const { providers } = useUserProviders();
  const [editOpen, setEditOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLOR_PRESETS[2]);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const onShareWorkflow = async () => {
    if (!base?.trim()) {
      await alert({
        title: "无法分享",
        message: "未配置主站地址",
        variant: "error",
      });
      return;
    }
    const subgraph = extractGroupSubgraph(nodes, edges, groupId, graphMeta ?? undefined);
    if (!subgraph?.nodes.length) {
      await alert({
        title: "无法分享",
        message: "组内无有效节点",
        variant: "error",
      });
      return;
    }
    const defaultName =
      (group?.data as { label?: string })?.label?.trim() || "工作流组";
    const name = await prompt({
      title: "分享工作流",
      message: "将本组节点结构保存为模板，可设为公开供他人复制。",
      label: "标题",
      defaultValue: defaultName,
      placeholder: "工作流名称",
      confirmLabel: "下一步",
      validate: (v) => (v.trim() ? null : "标题不能为空"),
    });
    if (!name) return;
    const description = await prompt({
      title: "工作流描述",
      message: "可选：说明适用场景与节点用途。",
      label: "描述",
      defaultValue: "",
      placeholder: "描述（可选）",
      confirmLabel: "分享",
    });
    if (description === null) return;
    const sharePublic = await confirm({
      title: "分享到社区？",
      message: "公开后将在首页「社区模板」展示；选「仅自己」则仅保存为私有模板。",
      confirmLabel: "公开到社区",
      cancelLabel: "仅自己可见",
    });
    setSharing(true);
    try {
      await shareWorkflowAsTemplate({
        base,
        name: name.trim(),
        description: description.trim(),
        graph: subgraph,
        edition,
        sourceLabel: defaultName,
        visibility: sharePublic ? "public" : "private",
      });
      await alert({
        title: sharePublic ? "已公开分享" : "已保存模板",
        message: sharePublic
          ? "工作流已出现在首页社区模板区。"
          : "可在「我的模板」中复用。",
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "分享失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSharing(false);
    }
  };

  const controller = useMemo(() => {
    if (!group || !kind) return undefined;
    const controllerId = (group.data as { pro2ControllerNodeId?: string })
      .pro2ControllerNodeId;
    if (controllerId) {
      const byId = nodes.find((n) => n.id === controllerId);
      if (byId) return byId;
    }
    if (kind === "character-board") {
      return nodes.find(
        (n) =>
          n.type === "story-pro2-character" &&
          (n.data as { pro2VisualGroupId?: string }).pro2VisualGroupId ===
            groupId,
      );
    }
    if (kind === "scene-board") {
      const hubId = (group?.data as { pro2HubNodeId?: string }).pro2HubNodeId;
      if (hubId) {
        const hub = nodes.find((n) => n.id === hubId);
        if (hub) return hub;
      }
      return nodes.find(
        (n) =>
          n.type === "story-pro2-scene" &&
          (n.data as { pro2VisualGroupId?: string }).pro2VisualGroupId ===
            groupId,
      );
    }
    if (kind === "frame-board") {
      return nodes.find(
        (n) =>
          n.type === "story-pro2-frame" &&
          (n.data as { pro2VisualGroupId?: string }).pro2VisualGroupId ===
            groupId,
      );
    }
    if (kind === "video-board") {
      return nodes.find(
        (n) =>
          n.type === "story-pro2-video" &&
          (n.data as { pro2VisualGroupId?: string }).pro2VisualGroupId ===
            groupId,
      );
    }
    return undefined;
  }, [group, groupId, kind, nodes]);

  const rowCount = useMemo(() => {
    if (kind === "character-board") {
      return readRows<StoryProCharacterRow>(controller).length;
    }
    if (kind === "scene-board") {
      if (controller?.type === "story-pro2-script-hub") {
        return readPro2SceneRowsForHub(controller.id, nodes).length;
      }
      return readRows<StoryProSceneRow>(controller).length;
    }
    if (kind === "frame-board") {
      return readRows<StoryProFrameRow>(controller).length;
    }
    if (kind === "video-board") {
      return readRows<StoryProVideoRow>(controller).length;
    }
    return 0;
  }, [controller, kind]);

  const downloadable = useMemo(() => {
    if (edition === "sbv1") {
      const items: { url: string; label: string }[] = [];
      for (const n of nodes) {
        if (n.parentId !== groupId) continue;
        if (n.type === "sbv1-image") {
          const url = imageUrlOf(n);
          if (!url) continue;
          items.push({
            url,
            label: ((n.data as { label?: string }).label ?? "image").trim(),
          });
        } else if (n.type === "sbv1-video-engine") {
          const url = videoUrlOf(n);
          if (!url) continue;
          items.push({
            url,
            label: ((n.data as { label?: string }).label ?? "video").trim(),
          });
        }
      }
      return items;
    }
    if (kind === "video-board") {
      return nodes
        .filter(
          (n) =>
            n.parentId === groupId &&
            n.type === "sbv1-video-engine" &&
            videoUrlOf(n),
        )
        .map((n) => ({
          url: videoUrlOf(n),
          label: ((n.data as { label?: string }).label ?? "video").trim(),
        }));
    }
    return nodes
      .filter(
        (n) =>
          n.parentId === groupId &&
          (n.type === "story-pro2-image" ||
            n.type === "story-pro2-three-view") &&
          imageUrlOf(n),
      )
      .map((n) => ({
        url: imageUrlOf(n),
        label: ((n.data as { label?: string }).label ?? "image").trim(),
      }));
  }, [edition, groupId, kind, nodes]);

  const videoBoardHasMedia = useMemo(() => {
    if (kind !== "video-board") return false;
    for (const n of nodes) {
      if (n.parentId !== groupId) continue;
      if (n.type === "sbv1-video-engine" && videoUrlOf(n)) return true;
    }
    const rows = readRows<StoryProVideoRow>(controller);
    return rows.some(
      (r) =>
        Boolean(r.videoRuntime?.ossUrl?.trim()) ||
        Boolean(r.videoRuntime?.ephemeralUrl?.trim()),
    );
  }, [kind, groupId, nodes, controller]);

  const canRegenerate =
    edition === "pro2" &&
    Boolean(kind && controller && rowCount) &&
    (kind !== "video-board" || videoBoardHasMedia);
  const canCopyGroup =
    edition === "pro2" &&
    Boolean(
      kind &&
        (kind === "scene-board" ||
          kind === "frame-board" ||
          kind === "video-board" ||
          kind === "character-board"),
    );

  const onRegenerateAll = () => {
    if (!controller) return;
    if (kind === "character-board") {
      const rows = readRows<StoryProCharacterRow>(controller);
      if (!rows.length) return;
      const refreshedRows = rows.map((row) => ({
        ...row,
        prompt: formatCharacterRowThreeViewPrompt({
          name: row.name,
          role: row.role,
          appearance: row.appearance,
        }),
      }));
      updateNodeData(controller.id, { rows: refreshedRows });
      batchRunStoryRows(
        controller.id,
        refreshedRows.map((r) => r.key),
        "threeView",
        { forceFresh: true },
      );
      return;
    }
    if (kind === "scene-board") {
      if (controller?.type === "story-pro2-script-hub") {
        const rows = readPro2SceneRowsForHub(controller.id, nodes);
        if (!rows.length) return;
        batchRunPro2SceneImageNodes(
          nodes,
          controller.id,
          rows,
          rows.map((r) => r.key),
          { forceFresh: true },
        );
        return;
      }
      const rows = readRows<StoryProSceneRow>(controller);
      if (!rows.length) return;
      batchRunStoryRows(
        controller.id,
        rows.map((r) => r.key),
        "sceneRef",
        { forceFresh: true },
      );
      return;
    }
    if (kind === "video-board") {
      const rows = readRows<StoryProVideoRow>(controller);
      if (!rows.length) return;
      batchRunStoryRows(
        controller.id,
        rows.map((r) => r.key),
        "video",
        { forceFresh: true },
      );
      return;
    }
    if (kind === "frame-board") {
      const rows = readRows<StoryProFrameRow>(controller);
      if (!rows.length) return;
      batchRunStoryRows(
        controller.id,
        rows.map((r) => r.key),
        "frameImage",
        { forceFresh: true },
      );
      return;
    }
  };

  const hubNodeId = (group?.data as { pro2HubNodeId?: string }).pro2HubNodeId;
  const frameRowsForVideo = useMemo(() => {
    if (kind !== "frame-board" || !controller) return [];
    return readRows<StoryProFrameRow>(controller);
  }, [kind, controller]);

  const initialVideoBatch = useMemo(() => {
    if (!hubNodeId) return null;
    return resolvePro2VideoBatchVideoForHub(hubNodeId, nodes, edges);
  }, [hubNodeId, nodes, edges]);

  const onGenerateVideoGroup = () => {
    if (kind !== "frame-board" || !controller || !hubNodeId) return;
    setVideoPickerOpen(true);
  };

  const runVideoGroupGenerate = (result: Pro2VideoGenerateResult) => {
    if (!controller || !hubNodeId) return;
    setVideoPickerOpen(false);
    const state = useCanvasStore.getState();
    kickoffPro2VideoBoardFromFrameGroup(
      () => ({
        nodes: state.nodes,
        edges: state.edges,
        addNode: state.addNode,
        addNodeInGroup: state.addNodeInGroup,
        createGroupContaining: state.createGroupContaining,
        setEdges: state.setEdges,
        updateNodeData: state.updateNodeData,
        setNodes: state.setNodes,
      }),
      {
        frameColumnId: controller.id,
        hubNodeId,
        selectedFrameIndices: result.frameIndices,
        batchVideo: result.batchVideo,
      },
      providers,
    );
  };

  const onCopyGroup = () => {
    duplicateMediaGroup(groupId);
  };

  const copyGroupTitle =
    kind === "video-board"
      ? "复制整组（含全部子节点）并从分镜图组再连一条线"
      : kind === "frame-board" || kind === "scene-board"
        ? "复制整组（含全部子节点）并从脚本中枢再连一条线"
        : "复制整组（含全部子节点）";
  const regenerateTitle =
    kind === "character-board"
      ? "重新生成全部三视图"
      : kind === "scene-board"
        ? "重新生成全部场景图"
        : kind === "video-board"
          ? "重新生成全部视频"
          : "重新生成全部分镜图";

  const onBatchDownload = async () => {
    if (!downloadable.length || downloading) return;
    setDownloading(true);
    try {
      for (let i = 0; i < downloadable.length; i++) {
        if (i > 0 && i % BATCH_DOWNLOAD_CHUNK === 0) {
          const remaining = downloadable.length - i;
          const ok = await confirm({
            title: "继续下载",
            message: `已下载 ${i} 个文件。浏览器限制连续下载，是否继续下载剩余 ${remaining} 个？`,
          });
          if (!ok) break;
        }
        const item = downloadable[i]!;
        const ext = downloadExt(
          item.url,
          /\.(mp4|webm|mov)/i.test(item.url) ? "mp4" : "png",
        );
        const base = sanitizeDownloadFilename(item.label || `media-${i + 1}`);
        await downloadOne(item.url, `${base}-${i + 1}.${ext}`);
        if (i < downloadable.length - 1) {
          await new Promise((r) => setTimeout(r, BATCH_DOWNLOAD_GAP_MS));
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  const openEdit = () => {
    setName((group?.data as { label?: string })?.label ?? "");
    setColor((group?.data as { color?: string })?.color ?? GROUP_COLOR_PRESETS[2]);
    setEditOpen((v) => !v);
  };

  const onSaveEdit = () => {
    updateNodeData(groupId, {
      label: name.trim() || "未命名分组",
      color,
    });
    setEditOpen(false);
  };

  return (
    <div className={className} style={style}>
      <div
        className={cn(
          PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
          passNodeDrag
            ? "pointer-events-none [&_button]:pointer-events-auto"
            : "nodrag pointer-events-auto",
        )}
        onMouseDown={
          passNodeDrag
            ? undefined
            : (e) => {
                onMouseDown?.(e);
                e.stopPropagation();
              }
        }
      >
        <span
          aria-hidden
          className="ml-0.5 size-2.5 shrink-0 rounded-full bg-white/90 nodrag pointer-events-none"
        />
        <LayoutGrid className="size-3.5 text-white/45 nodrag pointer-events-none" />
        <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />
        {canRegenerate ? (
          <button
            type="button"
            className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
            title={regenerateTitle}
            onClick={onRegenerateAll}
          >
            <RotateCw className="size-3.5" />
            重新生成
          </button>
        ) : null}
        {canCopyGroup ? (
          <button
            type="button"
            className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
            title={copyGroupTitle}
            onClick={onCopyGroup}
          >
            <Copy className="size-3.5" />
            复制组
          </button>
        ) : null}
        {kind === "frame-board" ? (
          <button
            type="button"
            className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
            title="选择镜号并生成分镜视频组（须已有分镜图）"
            onClick={onGenerateVideoGroup}
          >
            <Video className="size-3.5" />
            生成视频组
          </button>
        ) : null}
        {onRelayout ? (
          <button
            type="button"
            className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
            title="参考图与视频重新纳入组框"
            onClick={onRelayout}
          >
            <LayoutGrid className="size-3.5" />
            重排
          </button>
        ) : null}
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title={`把本组 ${childrenIds.length} 个子节点排成一行（横为主）`}
          disabled={childrenIds.length < 2}
          onClick={() => autoLayoutNodes(childrenIds, "row")}
        >
          <Columns3 className="size-3.5" />
          横排
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title={`把本组 ${childrenIds.length} 个子节点排成一列（竖为主）`}
          disabled={childrenIds.length < 2}
          onClick={() => autoLayoutNodes(childrenIds, "column")}
        >
          <Rows3 className="size-3.5" />
          竖排
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title={`按拓扑顺序自动整理本组 ${childrenIds.length} 个子节点`}
          disabled={childrenIds.length < 2}
          onClick={() => autoLayoutNodes(childrenIds, "auto")}
        >
          <LayoutGrid className="size-3.5" />
          自动
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title="改名 / 改边框色"
          onClick={openEdit}
        >
          <Palette className="size-3.5" />
          改名改色
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title={edition === "sbv1" ? "批量下载组内图片与视频" : "批量下载组内图片"}
          disabled={!downloadable.length || downloading}
          onClick={() => void onBatchDownload()}
        >
          {downloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          批量下载
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title="保存为资产"
          onClick={() =>
            saveGroupAsAsset(
              groupId,
              (group?.data ?? {}) as Record<string, unknown>,
            )
          }
        >
          <BookmarkPlus className="size-3.5" />
          保存为资产
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title="分享本组为工作流模板"
          disabled={sharing}
          onClick={() => void onShareWorkflow()}
        >
          {sharing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Share2 className="size-3.5" />
          )}
          分享工作流
        </button>
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          title="解组"
          onClick={() => ungroup(groupId)}
        >
          <Unlink className="size-3.5" />
          解组
        </button>
      </div>

      {editOpen ? (
        <div
          className={cn(
            "absolute left-1/2 top-[calc(100%+8px)] z-[1] w-[240px] -translate-x-1/2",
            PRO2_IMAGE_NODE_TOOLBAR_POPOVER_CLASS,
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="mb-1.5 text-[11px] font-medium text-white/55">组名</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") setEditOpen(false);
            }}
            placeholder="未命名分组"
            className="nodrag mb-2.5 w-full rounded-md border border-white/12 bg-black/40 px-2 py-1.5 text-[12px] text-white placeholder:text-white/35 focus:border-violet-400/50 focus:outline-none"
          />
          <p className="mb-1.5 text-[11px] font-medium text-white/55">边框颜色</p>
          <div className="mb-3 flex gap-2">
            {GROUP_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`颜色 ${c}`}
                onClick={() => setColor(c)}
                className="size-6 rounded-full transition"
                style={{
                  background: c,
                  outline:
                    color === c
                      ? `2px solid ${c}`
                      : "1px solid rgba(255,255,255,0.18)",
                  boxShadow: color === c ? `0 0 0 3px ${c}55` : "none",
                }}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1 text-[12px] text-white/60 hover:bg-white/8"
              onClick={() => setEditOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className={CANVAS_PRIMARY_BTN_SM_CLASS}
              onClick={onSaveEdit}
            >
              保存
            </button>
          </div>
        </div>
      ) : null}
      <Pro2VideoGeneratePicker
        open={videoPickerOpen}
        rows={frameRowsForVideo}
        initialBatchVideo={initialVideoBatch}
        onClose={() => setVideoPickerOpen(false)}
        onConfirm={runVideoGroupGenerate}
      />
    </div>
  );
}
