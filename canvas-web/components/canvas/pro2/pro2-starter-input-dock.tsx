"use client";

import { useCallback, useMemo } from "react";
import { ArrowUp, Languages, Loader2, Zap } from "lucide-react";
import { useNodes } from "@xyflow/react";
import {
  VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100,
} from "@/lib/canvas/libtv-dock-scale";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import { useLibtvFloatingDock } from "@/lib/canvas/use-libtv-floating-dock";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { STORY_PRO2_THEME_OUTLINE_SYSTEM } from "@/lib/canvas/story-pro2-theme-outline-prompt";
import {
  isPro2StoryOutlineTextNode,
  resolvePro2TextPurpose,
} from "@/lib/canvas/pro2-text-purpose";
import { isPro2StarterTextGenerating } from "@/lib/canvas/pro2-thin-node-display-state";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { formatCanvasTaskError } from "@/lib/canvas/friendly-task-error";
import {
  useLibtvRuntimeErrorAlert,
} from "@/lib/canvas/libtv-runtime-error-alert";
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
import {
  pro2StarterCanSendGeneralText,
} from "@/lib/canvas/pro2-starter-dock-send";
import {
  pro2TextNodeLlmNeedsVision,
} from "@/lib/canvas/pro2-text-node-engine-roles";
import { isStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";

/** 2.0 文本节点 · 底部输入坞 */
export function Pro2StarterInputDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const selectedStarter = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "story-pro2-starter",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedStarter) return null;
    return nodes.find((n) => n.id === selectedStarter.id) ?? null;
  }, [selectedStarter, nodes]);

  const dockNodeId = selectedStarter?.id ?? storeNode?.id ?? null;
  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

  const dockTextFontPx = VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100;
  const sendBtnPx = 44;
  const sendIconPx = 18;

  const d = (storeNode?.data ?? {}) as StoryProStarterNodeData;
  const textPurpose = useMemo(
    () =>
      storeNode
        ? resolvePro2TextPurpose(d, {
            nodeId: storeNode.id,
            nodes,
            edges,
          })
        : "story-outline",
    [storeNode, d, nodes, edges],
  );
  const isStoryOutlineMode = textPurpose === "story-outline";
  const themeInput = d.themeInput ?? "";
  const isGenerating = isPro2StarterTextGenerating(d);
  const outlineErrorMessage =
    isStoryOutlineMode && d.themeOutlineRuntime?.status === "error"
      ? formatCanvasTaskError(
          d.themeOutlineRuntime.failCode,
          d.themeOutlineRuntime.failMessage,
          d.modelKey,
        )
      : null;

  useLibtvRuntimeErrorAlert({
    enabled: isStoryOutlineMode && Boolean(outlineErrorMessage) && Boolean(storeNode),
    nodeId: storeNode?.id ?? "",
    status: d.themeOutlineRuntime?.status,
    taskId: d.themeOutlineRuntime?.taskId,
    failCode: d.themeOutlineRuntime?.failCode,
    failMessage: outlineErrorMessage ?? undefined,
    dismissedFailTaskId: d.themeOutlineRuntime?.dismissedFailTaskId,
    onAlert: ({ message }) => {
      void alert({
        title: "大纲生成失败",
        message,
        variant: "error",
      });
    },
  });

  const onSendGeneralText = useCallback(async () => {
    if (!storeNode) return;
    const text = themeInput.trim();
    const canSend = pro2StarterCanSendGeneralText({
      themeInput: text,
      pro2PresetKind: d.pro2PresetKind,
      nodeId: storeNode.id,
      nodes,
      edges,
    });
    if (!canSend) {
      await alert({
        title: "请先填写提示词",
        message:
          String(d.pro2PresetKind ?? "") === "image-to-prompt"
            ? "在图片节点上传图片后再生成，或在输入框补充说明。"
            : "在输入框写下提示词或指令后再生成。",
        variant: "warning",
      });
      return;
    }
    const live = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === storeNode.id);
    const liveData = (live?.data ?? {}) as StoryProStarterNodeData;
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
          "图片/视频反推提示词须使用 Gemini 3 Flash 或 GPT-5.5 等多模态文本模型；DeepSeek / 通义等纯文本模型无法读取参考图。",
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
      themeInput: text,
      generatedOutlineMd: undefined,
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
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
    }
  }, [storeNode, themeInput, d.pro2PresetKind, nodes, edges, base, alert, updateNodeData]);

  const onSendOutline = useCallback(async () => {
    if (!storeNode) return;
    const theme = themeInput.trim();
    if (!theme) {
      await alert({
        title: "请先填写故事",
        message: "在输入框写下故事主题或内容后再发送。",
        variant: "warning",
      });
      return;
    }
    const live = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === storeNode.id);
    const liveData = (live?.data ?? {}) as StoryProStarterNodeData;
    if (!liveData.providerId?.trim() || !liveData.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "点击左下角模型选择器，选择 LLM 后再发送。",
        variant: "warning",
      });
      return;
    }
    if (!isPro2StoryOutlineTextNode(liveData, { nodeId: storeNode.id, nodes, edges })) {
      await alert({
        title: "无法生成故事大纲",
        message:
          "该文本节点用于提示词/下游引用（文生图、生视频、反推等），不会走故事大纲链路。",
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
      themeInput: theme,
      generatedOutlineMd: undefined,
      starterMode: "generate",
      themeOutlineSystemPrompt: STORY_PRO2_THEME_OUTLINE_SYSTEM,
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
      },
    });
    const queued = busEnqueueStoryRun({
      nodeId: storeNode.id,
      mediaKind: "themeOutline",
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
    }
  }, [storeNode, themeInput, base, alert, updateNodeData, nodes, edges]);

  const onSend = isStoryOutlineMode ? onSendOutline : onSendGeneralText;
  const sendTitle = isStoryOutlineMode ? "生成故事大纲" : "生成";
  const canSendGeneral = pro2StarterCanSendGeneralText({
    themeInput,
    pro2PresetKind: d.pro2PresetKind,
    nodeId: storeNode?.id ?? "",
    nodes,
    edges,
  });
  const generalErrorMessage =
    !isStoryOutlineMode && d.themeOutlineRuntime?.status === "error"
      ? formatCanvasTaskError(
          d.themeOutlineRuntime.failCode,
          d.themeOutlineRuntime.failMessage,
          d.modelKey,
        )
      : null;

  useLibtvRuntimeErrorAlert({
    enabled:
      !isStoryOutlineMode &&
      Boolean(generalErrorMessage) &&
      Boolean(storeNode),
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
  const placeholder = isStoryOutlineMode
    ? "写下你想讲的故事、场景或角色设定。输入 @ 可引用已链接的图片。"
    : "输入提示词，供下游生图/生视频使用；输入 @ 可引用已链接的图片。";

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-starter",
      nodes,
      edges,
    );
  }, [storeNode, nodes, edges]);

  const mentionables = useMemo(
    () => buildPro2DockMentionables(upstreamLinks),
    [upstreamLinks],
  );
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(themeInput),
    [themeInput],
  );

  usePruneStaleDockMentions({
    nodeId: storeNode?.id ?? null,
    prompt: themeInput,
    mentionables,
    field: "themeInput",
    updateNodeData,
  });

  if (!storeNode || !dockActive || !placement) return null;

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-starter-dock"
      hidden={dockHidden}
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
              refs={[]}
              onChange={() => {}}
              disabled={isGenerating}
              pasteActive={false}
              spawnAnchor={{
                nodeId: storeNode.id,
                nodeType: "story-pro2-starter",
              }}
              maxCount={12}
            />
          }
        />
      }
      footer={
        <>
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
              {isStoryOutlineMode ? (
                <>
                  <button
                    type="button"
                    className="nodrag rounded-md p-1.5 text-white/35 hover:bg-white/6 hover:text-white/60"
                    title="翻译（预留）"
                    disabled
                  >
                    <Languages style={{ width: sendIconPx, height: sendIconPx }} />
                  </button>
                  <button
                    type="button"
                    className="nodrag flex items-center gap-0.5 rounded-md px-1.5 py-1 text-white/35"
                    style={{ fontSize: dockTextFontPx }}
                    title="消耗（预留）"
                    disabled
                  >
                    <Zap style={{ width: sendIconPx, height: sendIconPx }} />
                    <span>1</span>
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={
                  isGenerating ||
                  (isStoryOutlineMode ? !themeInput.trim() : !canSendGeneral)
                }
                className="nodrag flex items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ width: sendBtnPx, height: sendBtnPx }}
                title={sendTitle}
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
        </>
      }
    >
      <Pro2DockPasteZone
        anchorNodeId={storeNode.id}
        anchorNodeType="story-pro2-starter"
        disabled={isGenerating}
        maxImages={12}
      >
        <MentionsEditable
          className={cn(
            PRO2_DOCK_TEXTAREA_CLASS,
            RF_FORM_CONTROL,
            RF_NO_WHEEL,
            PRO2_DOCK_TEXTAREA_INSET_CLASS,
          )}
          placeholder={placeholder}
          value={themeInput}
          mentionables={mentionables}
          disabled={isGenerating}
          rows={3}
          mentionInlineThumb
          mentionEdition="pro2"
          onChange={(value, _refs, meta) =>
            updateNodeData(storeNode.id, { themeInput: value }, {
              commit: meta?.commit ?? true,
            })
          }
        />
      </Pro2DockPasteZone>
    </Pro2InputDockShell>
  );
}
