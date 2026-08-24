"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import { Pro2LlmDockCreditsBadge } from "./pro2-llm-dock-credits-badge";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { LibtvDockSendButton } from "@/components/canvas/libtv-dock-send-button";
import { useCanvasStore } from "@/lib/canvas/store";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { useLibtvFloatingDock, useLibtvSoleSelectedNodeId } from "@/lib/canvas/use-libtv-floating-dock";
import { useLibtvShouldSuppressFloatingDock } from "@/lib/canvas/libtv-floating-dock-selection";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import {
  enqueuePro2ScriptGeneration,
  pro2HubCanSendScriptPhase,
  pro2HubIsGenerating,
  pro2HubScriptPhaseLabel,
} from "@/lib/canvas/pro2-script-hub-helpers";
import {
  pro2ScriptRefImageBadgeOffset,
  stripLegacyPro2ScriptDockInput,
} from "@/lib/canvas/pro2-script-category-doc";
import { applyPro2ScriptCategoryFromHub } from "@/lib/canvas/spawn-pro2-script-category-from-hub";
import type { Pro2ScriptCategoryId } from "@/lib/canvas/pro2-script-category-presets";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import { cn } from "@/lib/utils";
import {
  Pro2LlmDockModelPicker,
  Pro2LlmDockParamsPicker,
} from "./pro2-llm-dock-pickers";
import {
  Pro2DockHeader,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2-input-dock-shell";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";
import { Pro2DockPasteZone } from "./pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";
import { Pro2ScriptCategoryDocChip } from "./pro2-script-category-doc-chip";

const SCRIPT_PLACEHOLDER =
  "一句话生成剧本：描述剧情或添加角色/场景参考，为你生成分镜脚本；上传剧本生成分镜脚本：在节点内点击上传按钮";

const CUSTOM_PROMPT_DOCK_PLACEHOLDER =
  "在此编写你的完整剧本提示词（创意、风格、角色、分镜要求等）；发送后系统将按 GFM 制作包自动补全结构化输出";

/** 2.0 脚本节点 · 底部输入坞（与文本节点统一外壳） */
export function Pro2ScriptInputDock() {
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const dockNodeId = useLibtvSoleSelectedNodeId("story-pro2-script-hub");
  const suppressDock = useLibtvShouldSuppressFloatingDock();
  const storeNode = useMemo(() => {
    if (!dockNodeId) return null;
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);

  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);

  useEffect(() => {
    setDockMenu(null);
  }, [dockNodeId]);

  const d = (storeNode?.data ?? {}) as StoryProScriptHubNodeData;
  const { history: hubTasks } = useNodeTaskHistory(storeNode?.id);
  const dockInput = d.dockInput ?? "";
  const dockRefImages = (d.dockRefImages ?? []) as StoryRefImage[];
  const phase = pro2HubScriptPhaseLabel(d, {
    nodeId: storeNode?.id,
    nodes,
    edges,
  });

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-script-hub",
      nodes,
      edges,
    );
  }, [storeNode, nodes, edges]);

  const mentionables = useMemo(
    () => buildPro2DockMentionables(upstreamLinks, dockRefImages),
    [upstreamLinks, dockRefImages],
  );
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(dockInput),
    [dockInput],
  );

  usePruneStaleDockMentions({
    nodeId: storeNode?.id ?? null,
    prompt: dockInput,
    mentionables,
    field: "dockInput",
    updateNodeData,
  });

  useEffect(() => {
    if (!storeNode) return;
    const cleaned = stripLegacyPro2ScriptDockInput(dockInput);
    if (cleaned !== dockInput) {
      updateNodeData(storeNode.id, { dockInput: cleaned }, { commit: true });
    }
  }, [storeNode, dockInput, updateNodeData]);

  const hasPromptChip = true;
  const refBadgeOffset = pro2ScriptRefImageBadgeOffset(
    upstreamLinks.length,
    hasPromptChip,
  );

  const onCategoryApply = useCallback(
    (categoryId: Pro2ScriptCategoryId) => {
      if (!storeNode) return;
      applyPro2ScriptCategoryFromHub(storeNode.id, categoryId, {
        nodes: useCanvasStore.getState().nodes,
        edges: useCanvasStore.getState().edges,
        addNode,
        setEdges,
        setNodes,
        updateNodeData,
      });
    },
    [storeNode, addNode, setEdges, setNodes, updateNodeData],
  );

  const hubRfNode = storeNode
    ? ({
        id: storeNode.id,
        data: d,
        type: "story-pro2-script-hub",
        position: storeNode.position,
      } as const)
    : null;

  const isGenerating = hubRfNode
    ? pro2HubIsGenerating(hubRfNode as never, hubTasks)
    : false;
  const canSendScript = hubRfNode
    ? pro2HubCanSendScriptPhase(hubRfNode as never, d, { nodes, edges, hubTasks })
    : false;
  const isCustomPrompt = d.scriptCategoryId === "custom-prompt";
  const canSend = isCustomPrompt
    ? Boolean(dockInput.trim()) &&
      Boolean(d.providerId?.trim() && d.modelKey?.trim()) &&
      !isGenerating
    : (canSendScript || Boolean(dockInput.trim())) &&
      Boolean(d.providerId?.trim() && d.modelKey?.trim()) &&
      !isGenerating;

  useEffect(() => {
    if (!storeNode || d.providerId) return;
    const pick = pickDefaultStoryLlmEngine(providers);
    if (!pick) return;
    updateNodeData(storeNode.id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
      params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    });
  }, [storeNode, d.providerId, providers, updateNodeData]);

  useEffect(() => {
    if (!storeNode) return;
    const modelKey = d.modelKey?.trim() ?? "";
    const providerId = d.providerId?.trim() ?? "";
    if (!modelKey.startsWith("kimi-")) return;
    if (providerId === "gateway:bailian") return;
    const bailian = providers.find((p) => p.id === "gateway:bailian" && p.active);
    if (!bailian?.models.some((m) => m.modelKey === modelKey && m.enabled)) return;
    updateNodeData(storeNode.id, { providerId: "gateway:bailian" });
  }, [storeNode, d.modelKey, d.providerId, providers, updateNodeData]);

  const onPickEngine = useCallback(
    (next: {
      providerId: string;
      modelKey: string;
      params: Record<string, unknown>;
    }) => {
      if (!storeNode) return;
      updateNodeData(storeNode.id, {
        providerId: next.providerId,
        modelKey: next.modelKey,
        params: next.params,
      });
    },
    [storeNode, updateNodeData],
  );

  const nodeId = storeNode?.id;

  const onSend = useCallback(async () => {
    if (!nodeId) return;
    if (isGenerating) {
      void canvasNotify({
        title: "剧本生成进行中",
        message: "请等待当前段落完成，或刷新页面后重试。",
        variant: "info",
      });
      return;
    }
    // 发送钮在 pointerdown 已 flush 草稿；这里从 store 读最新值，避免用到上一帧的空 prompt
    const snapshot = useCanvasStore.getState();
    const freshNode = snapshot.nodes.find((n) => n.id === nodeId);
    if (!freshNode) return;
    const fd = (freshNode.data ?? {}) as StoryProScriptHubNodeData;
    const freshInput = fd.dockInput ?? "";
    const freshRefImages = (fd.dockRefImages ?? []) as StoryRefImage[];
    const freshNodes = snapshot.nodes;
    const freshEdges = snapshot.edges;
    const freshRfNode = {
      id: nodeId,
      data: fd,
      type: "story-pro2-script-hub",
      position: freshNode.position,
    } as const;

    if (!fd.providerId?.trim() || !fd.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "点击左下角模型选择器，选择 LLM 后再发送。",
        variant: "warning",
      });
      return;
    }

    const isCustomPrompt = fd.scriptCategoryId === "custom-prompt";
    const canRun = isCustomPrompt
      ? Boolean(freshInput.trim())
      : Boolean(freshInput.trim()) ||
        pro2HubCanSendScriptPhase(freshRfNode as never, fd, {
          nodes: freshNodes,
          edges: freshEdges,
          hubTasks,
        });
    if (!canRun) {
      await alert({
        title: "请先提供创意输入",
        message:
          "连接上游文本节点、在 Dock 输入主题，或确保已有故事大纲后再发送。",
        variant: "warning",
      });
      return;
    }

    enqueuePro2ScriptGeneration(
      nodeId,
      freshInput,
      freshRefImages,
      updateNodeData,
      {
        forceFresh: true,
        nodes: freshNodes,
        edges: freshEdges,
        hubData: fd,
      },
    );
  }, [nodeId, updateNodeData, alert, isGenerating]);

  if (suppressDock || !storeNode || !dockActive || !placement) return null;

  const placeholder =
    d.scriptCategoryId === "custom-prompt"
      ? CUSTOM_PROMPT_DOCK_PLACEHOLDER
      : SCRIPT_PLACEHOLDER;
  const llmParams = d.params ?? { ...STORY_PRO_LLM_PARAMS_DEFAULT };

  return (
    <>
    <Pro2InputDockShell
      key={storeNode.id}
      flowAnchor={placement}
      dockClassName="pro2-script-dock"
      hidden={dockHidden}
      anchorNodeId={storeNode.id}
      header={
        <Pro2DockHeader
          refRow={
            <>
              {upstreamLinks.length > 0 ? (
                <Pro2DockUpstreamChips
                  links={upstreamLinks}
                  anchorNodeId={storeNode.id}
                  activeIds={activeRefIds}
                />
              ) : null}
              <Pro2DockRefImages
                refs={dockRefImages}
                onChange={(next) =>
                  updateNodeData(storeNode.id, { dockRefImages: next })
                }
                promptValue={dockInput}
                onPromptChange={(next) =>
                  updateNodeData(storeNode.id, { dockInput: next }, { commit: true })
                }
                disabled={isGenerating}
                pasteActive={false}
                activeIds={activeRefIds}
                badgeIndexOffset={refBadgeOffset}
                spawnAnchor={{
                  nodeId: storeNode.id,
                  nodeType: "story-pro2-script-hub",
                }}
                maxCount={12}
              />
            </>
          }
          trailingRow={
            <Pro2ScriptCategoryDocChip
              hubData={d}
              upstreamLinks={upstreamLinks}
              disabled={isGenerating}
              onSaveBody={(body) =>
                updateNodeData(
                  storeNode.id,
                  { scriptCategoryDocBody: body },
                  { commit: true },
                )
              }
              onSaveCustomPrompt={(body) =>
                updateNodeData(storeNode.id, { dockInput: body }, { commit: true })
              }
              onCategoryApply={onCategoryApply}
            />
          }
        />
      }
      footer={
        <Pro2ScriptDockFooter
          providerId={d.providerId ?? ""}
          modelKey={d.modelKey ?? ""}
          params={llmParams}
          providers={providers}
          dockMenu={dockMenu}
          onDockMenuChange={setDockMenu}
          isGenerating={isGenerating}
          canSend={canSend}
          phase={phase}
          onPickEngine={onPickEngine}
          onSend={() => void onSend()}
        />
      }
    >
      <Pro2DockPasteZone
        anchorNodeId={storeNode.id}
        anchorNodeType="story-pro2-script-hub"
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
          placeholder={`${placeholder}（输入 @ 引用大纲或参考图）`}
          value={dockInput}
          mentionables={mentionables}
          disabled={isGenerating}
          rows={3}
          mentionInlineThumb
          mentionEdition="pro2"
          onChange={(value, _refs, meta) =>
            updateNodeData(storeNode.id, { dockInput: value }, {
              commit: meta?.commit ?? true,
            })
          }
        />
      </Pro2DockPasteZone>
    </Pro2InputDockShell>
    </>
  );
}

function Pro2ScriptDockFooter({
  providerId,
  modelKey,
  params,
  providers,
  dockMenu,
  onDockMenuChange,
  isGenerating,
  canSend,
  phase,
  onPickEngine,
  onSend,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  providers: ReturnType<typeof useUserProviders>["providers"];
  dockMenu: "model" | "params" | null;
  onDockMenuChange: (menu: "model" | "params" | null) => void;
  isGenerating: boolean;
  canSend: boolean;
  phase: string;
  onPickEngine: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
  onSend: () => void;
}) {
  const { fontPx, sendIconPx } = useLibtvDockToolbarMetrics();

  return (
    <Pro2DockToolbar className="gap-2">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-0.5">
        <Pro2LlmDockModelPicker
          providerId={providerId}
          modelKey={modelKey}
          params={params}
          allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
          externalProviders={providers}
          disabled={isGenerating}
          open={dockMenu === "model"}
          onOpenChange={(next) => onDockMenuChange(next ? "model" : null)}
          onConfirm={onPickEngine}
        />
        <Pro2LlmDockParamsPicker
          providerId={providerId}
          modelKey={modelKey}
          params={params}
          externalProviders={providers}
          disabled={isGenerating}
          open={dockMenu === "params"}
          onOpenChange={(next) => onDockMenuChange(next ? "params" : null)}
          onConfirm={(nextParams) =>
            onPickEngine({ providerId, modelKey, params: nextParams })
          }
        />
      </div>
      <div
        className="relative z-20 flex shrink-0 items-center gap-1.5 text-white/35"
        style={{ fontSize: fontPx }}
      >
        <button
          type="button"
          className="nodrag rounded-md p-1.5 text-white/35"
          title="翻译（预留）"
          disabled
        >
          <Languages style={{ width: sendIconPx, height: sendIconPx }} />
        </button>
        <Pro2LlmDockCreditsBadge modelKey={modelKey} fontPx={fontPx} />
        <LibtvDockSendButton
          disabled={!canSend}
          loading={isGenerating}
          title={phase === "frame" ? "重新生成脚本" : "生成分镜脚本"}
          onClick={onSend}
        />
      </div>
    </Pro2DockToolbar>
  );
}
