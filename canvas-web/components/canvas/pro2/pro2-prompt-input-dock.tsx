"use client";

import { useCallback, useMemo, useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import {
  VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100,
} from "@/lib/canvas/libtv-dock-scale";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import { useLibtvFloatingDock, useLibtvSoleSelectedNodeId } from "@/lib/canvas/use-libtv-floating-dock";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { useLibtvShouldSuppressFloatingDock } from "@/lib/canvas/libtv-floating-dock-selection";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import type { MentionsTextareaCommitHandle } from "@/components/canvas/mentions/MentionsTextarea";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { LIBTV_INPUT_DOCK_SEND_BTN_CLASS } from "@/lib/canvas/libtv-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { isPro2StarterTextGenerating } from "@/lib/canvas/pro2-thin-node-display-state";
import type { StoryPro2PromptNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import { useLibtvRuntimeErrorAlert } from "@/lib/canvas/libtv-runtime-error-alert";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { Pro2TextNodeEnginePickers } from "./pro2-text-node-engine-pickers";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import {
  Pro2DockHeader,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2-input-dock-shell";
import { Pro2DockPasteZone } from "./pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";
import { pro2PromptCanSend } from "@/lib/canvas/pro2-prompt-dock-send";
import { pro2TextNodeLlmNeedsVision } from "@/lib/canvas/pro2-text-node-engine-roles";
import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";

/** 2.0 提示词节点 · 底部输入坞 */
export function Pro2PromptInputDock() {
  const dockNodeId = useLibtvSoleSelectedNodeId("story-pro2-prompt");
  const suppressDock = useLibtvShouldSuppressFloatingDock();
  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

  if (suppressDock || !dockNodeId || !dockActive || !placement) return null;

  return (
    <Pro2PromptInputDockBody
      key={dockNodeId}
      dockNodeId={dockNodeId}
      placement={placement}
      dockHidden={dockHidden}
    />
  );
}

function Pro2PromptInputDockBody({
  dockNodeId,
  placement,
  dockHidden,
}: {
  dockNodeId: string;
  placement: LibtvDockFlowPlacement;
  dockHidden: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const storeNode = useMemo(() => {
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);

  const dockTextFontPx = VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100;
  const sendBtnPx = 44;
  const sendIconPx = 18;
  const promptCommitRef = useRef<MentionsTextareaCommitHandle | null>(null);

  const d = (storeNode?.data ?? {}) as StoryPro2PromptNodeData;
  const prompt = d.prompt ?? "";
  const isGenerating = isPro2StarterTextGenerating(d);

  const readLivePrompt = useCallback((nodeId: string) => {
    promptCommitRef.current?.flushDraft();
    const live = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    return String((live?.data as StoryPro2PromptNodeData | undefined)?.prompt ?? "").trim();
  }, []);

  const onSend = useCallback(async () => {
    if (!storeNode) return;
    if (isPro2StarterTextGenerating(d)) return;
    const text = readLivePrompt(storeNode.id);
    if (
      !pro2PromptCanSend({
        prompt: text,
        nodeId: storeNode.id,
        nodes,
        edges,
      })
    ) {
      await alert({
        title: "请先填写提示词",
        message: "在输入框写下提示词，或链接已上传的图片/视频后再发送。",
        variant: "warning",
      });
      return;
    }
    const live = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === storeNode.id);
    const liveData = (live?.data ?? {}) as StoryPro2PromptNodeData;
    if (!liveData.providerId?.trim() || !liveData.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "点击左下角模型选择器，选择 Text model 后再生成。",
        variant: "warning",
      });
      return;
    }
    const needsVision = pro2TextNodeLlmNeedsVision(liveData, {
      nodeId: storeNode.id,
      nodes,
      edges,
    });
    if (needsVision && !isStoryLlmVisionModel(liveData.modelKey)) {
      await alert({
        title: "请换用支持图片理解的模型",
        message:
          "引用图片/视频反推提示词须使用 Doubao Seed 2.1 Pro、Gemini 3 Flash 或 GPT-5.5 等多模态文本模型。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    updateNodeData(storeNode.id, {
      prompt: text,
      generatedText: undefined,
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
        dismissedFailTaskId: undefined,
      },
    });
    const queued = busEnqueueStoryRun({
      nodeId: storeNode.id,
      mediaKind: "generalText",
      forceFresh: true,
    });
    if (!queued) {
      updateNodeData(storeNode.id, {
        themeOutlineRuntime: {
          status: "error",
          failCode: "RUN_QUEUE_BUSY",
          failMessage: "生成任务未能入队，请稍候再试。",
        },
      });
      await alert({
        title: "生成未能开始",
        message: "任务队列繁忙或上一任务仍在进行，请稍候再试。",
        variant: "warning",
      });
    }
  }, [storeNode, d, nodes, edges, base, alert, updateNodeData, readLivePrompt]);

  const generalErrorMessage =
    d.themeOutlineRuntime?.status === "error"
      ? formatCanvasTaskError(
          d.themeOutlineRuntime.failCode,
          d.themeOutlineRuntime.failMessage,
          d.modelKey,
        )
      : null;

  useLibtvRuntimeErrorAlert({
    enabled: Boolean(generalErrorMessage) && Boolean(storeNode),
    nodeId: storeNode?.id ?? "",
    status: d.themeOutlineRuntime?.status,
    taskId: d.themeOutlineRuntime?.taskId,
    failCode: d.themeOutlineRuntime?.failCode,
    failMessage: generalErrorMessage ?? undefined,
    dismissedFailTaskId: d.themeOutlineRuntime?.dismissedFailTaskId,
    onAlert: ({ message }) => {
      void alert({
        title: "生成失败",
        message,
        variant: "error",
      });
    },
  });

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-prompt",
      nodes,
      edges,
    );
  }, [storeNode, nodes, edges]);

  const mentionables = useMemo(
    () => buildPro2DockMentionables(upstreamLinks),
    [upstreamLinks],
  );
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(prompt),
    [prompt],
  );

  usePruneStaleDockMentions({
    nodeId: storeNode?.id ?? null,
    prompt,
    mentionables,
    field: "prompt",
    updateNodeData,
  });

  const canSend = pro2PromptCanSend({
    prompt,
    nodeId: storeNode?.id ?? "",
    nodes,
    edges,
  });

  if (!storeNode) return null;

  return (
    <Pro2InputDockShell
      key={storeNode.id}
      flowAnchor={placement}
      dockClassName="pro2-prompt-dock"
      hidden={dockHidden}
      anchorNodeId={storeNode.id}
      header={
        <Pro2DockHeader
          refRow={
            upstreamLinks.length > 0 ? (
              <Pro2DockUpstreamChips
                links={upstreamLinks}
                anchorNodeId={storeNode.id}
                activeIds={activeRefIds}
              />
            ) : null
          }
          actionRow={
            <Pro2DockRefImages
              refs={d.dockRefImages ?? []}
              onChange={(refs) =>
                updateNodeData(storeNode.id, { dockRefImages: refs })
              }
              disabled={isGenerating}
              pasteActive={false}
              spawnAnchor={{
                nodeId: storeNode.id,
                nodeType: "story-pro2-prompt",
              }}
              maxCount={12}
            />
          }
        />
      }
      footer={
        <Pro2DockToolbar>
          <Pro2TextNodeEnginePickers
            nodeId={storeNode.id}
            data={d}
            nodes={nodes}
            edges={edges}
            providers={providers}
            disabled={isGenerating}
            updateNodeData={updateNodeData}
            triggerFontPx={dockTextFontPx}
            sectionFontPx={sendIconPx}
          />
          <div
            className="flex shrink-0 items-center gap-1"
            style={{ fontSize: dockTextFontPx }}
          >
            <button
              type="button"
              disabled={isGenerating || !canSend}
              className={cn(LIBTV_INPUT_DOCK_SEND_BTN_CLASS)}
              style={{ width: sendBtnPx, height: sendBtnPx }}
              title="生成"
              onClick={() => void onSend()}
            >
              {isGenerating ? (
                <Loader2
                  className="animate-spin"
                  style={{ width: sendIconPx, height: sendIconPx }}
                />
              ) : (
                <ArrowUp style={{ width: sendIconPx, height: sendIconPx }} />
              )}
            </button>
          </div>
        </Pro2DockToolbar>
      }
    >
      <Pro2DockPasteZone
        anchorNodeId={storeNode.id}
        anchorNodeType="story-pro2-prompt"
        disabled={isGenerating}
        maxImages={12}
      >
        <MentionsEditable
          key={storeNode.id}
          sourceId={storeNode.id}
          className={cn(
            PRO2_DOCK_TEXTAREA_CLASS,
            RF_FORM_CONTROL,
            RF_NO_WHEEL,
            PRO2_DOCK_TEXTAREA_INSET_CLASS,
          )}
          placeholder="输入提示词；@ 可引用已链接的上游文本或图片。"
          value={prompt}
          mentionables={mentionables}
          disabled={isGenerating}
          rows={3}
          mentionInlineThumb
          mentionEdition="pro2"
          commitHandleRef={promptCommitRef}
          onChange={(value, _refs, meta) =>
            updateNodeData(storeNode.id, { prompt: value }, {
              commit: meta?.commit ?? true,
            })
          }
        />
      </Pro2DockPasteZone>
    </Pro2InputDockShell>
  );
}
