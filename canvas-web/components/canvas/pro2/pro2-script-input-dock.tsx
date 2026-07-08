"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Languages, Zap } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { LibtvDockSendButton } from "@/components/canvas/libtv-dock-send-button";
import { useCanvasStore } from "@/lib/canvas/store";
import { useLibtvFloatingDock, useLibtvSoleSelectedNodeId } from "@/lib/canvas/use-libtv-floating-dock";
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
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
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

const SCRIPT_PLACEHOLDER =
  "一句话生成剧本：描述剧情或添加角色/场景参考，为你生成分镜脚本；上传剧本生成分镜脚本：在节点内点击上传按钮";

/** 2.0 脚本节点 · 底部输入坞（与文本节点统一外壳） */
export function Pro2ScriptInputDock() {
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const dockNodeId = useLibtvSoleSelectedNodeId("story-pro2-script-hub");
  const storeNode = useMemo(() => {
    if (!dockNodeId) return null;
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);

  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);

  const d = (storeNode?.data ?? {}) as StoryProScriptHubNodeData;
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

  const hubRfNode = storeNode
    ? ({
        id: storeNode.id,
        data: d,
        type: "story-pro2-script-hub",
        position: storeNode.position,
      } as const)
    : null;

  const isGenerating = hubRfNode ? pro2HubIsGenerating(hubRfNode as never) : false;
  const canSendScript = hubRfNode
    ? pro2HubCanSendScriptPhase(hubRfNode as never, d, { nodes, edges })
    : false;
  const canSend = canSendScript || Boolean(dockInput.trim());

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

  const onSend = useCallback(async () => {
    if (!storeNode || !hubRfNode) return;

    if (!d.providerId?.trim() || !d.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "点击左下角模型选择器，选择 LLM 后再发送。",
        variant: "warning",
      });
      return;
    }

    const hasDockInput = Boolean(dockInput.trim());
    const canRun =
      hasDockInput ||
      pro2HubCanSendScriptPhase(hubRfNode as never, d, { nodes, edges });
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
      storeNode.id,
      dockInput,
      dockRefImages,
      updateNodeData,
      { forceFresh: true, nodes, edges, hubData: d, regenerateAll: true },
    );
  }, [
    storeNode,
    hubRfNode,
    d,
    dockInput,
    dockRefImages,
    nodes,
    edges,
    updateNodeData,
    alert,
  ]);

  if (!storeNode || !dockActive || !placement) return null;

  const placeholder = SCRIPT_PLACEHOLDER;
  const llmParams = d.params ?? { ...STORY_PRO_LLM_PARAMS_DEFAULT };

  return (
    <>
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-script-dock"
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
              spawnAnchor={{
                nodeId: storeNode.id,
                nodeType: "story-pro2-script-hub",
              }}
              maxCount={12}
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
        className="flex shrink-0 items-center gap-1.5 text-white/35"
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
        <button
          type="button"
          className="nodrag flex items-center gap-0.5 rounded-md px-1.5 py-1 text-white/35"
          style={{ fontSize: fontPx }}
          title="消耗（预留）"
          disabled
        >
          <Zap style={{ width: sendIconPx, height: sendIconPx }} />
          <span>1</span>
        </button>
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
