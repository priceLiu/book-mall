"use client";

import { useCallback, useEffect, useMemo } from "react";
import { ArrowUp, Languages, Loader2, Zap } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { libtvFloatingDockHidden } from "@/lib/canvas/use-viewport-transform-active";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
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
import { EnginePicker } from "../engine-picker";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { usePro2DockPlacement } from "./use-pro2-dock-placement";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2-input-dock-shell";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";
import { Pro2DockPasteZone } from "./pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";

const SCRIPT_PLACEHOLDER =
  "描述剧情或添加角色参考、场景参考等，为你生成分镜脚本";

/** 2.0 脚本节点 · 底部输入坞（与文本节点统一外壳） */
export function Pro2ScriptInputDock() {
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const selectedHub = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "story-pro2-script-hub",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedHub) return null;
    return nodes.find((n) => n.id === selectedHub.id) ?? null;
  }, [selectedHub, nodes]);

  const dockHidden = useCanvasStore((s) =>
    libtvFloatingDockHidden(
      s.canvasGeometryDragging,
      s.canvasDraggingNodeId,
      storeNode?.id ?? null,
    ),
  );

  const placement = usePro2DockPlacement(selectedHub?.id ?? null);
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

  if (!storeNode || !placement) return null;

  const placeholder = SCRIPT_PLACEHOLDER;

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-script-dock"
      hidden={dockHidden}
      header={
        <Pro2DockContextBar>
          <Pro2DockUpstreamChips
            links={upstreamLinks}
            anchorNodeId={storeNode.id}
            activeIds={activeRefIds}
          />
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
        </Pro2DockContextBar>
      }
      footer={
        <>
          <Pro2DockToolbar>
            <div className="min-w-0 flex-1">
              <EnginePicker
                role="LLM"
                allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
                providerId={d.providerId ?? ""}
                modelKey={d.modelKey ?? ""}
                params={d.params ?? {}}
                onChange={onPickEngine}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="nodrag rounded-md p-1.5 text-white/35"
                title="翻译（预留）"
                disabled
              >
                <Languages className="size-4" />
              </button>
              <button
                type="button"
                className="nodrag flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] text-white/35"
                title="消耗（预留）"
                disabled
              >
                <Zap className="size-3.5" />
                <span>1</span>
              </button>
              <button
                type="button"
                disabled={isGenerating || !canSend}
                className="nodrag flex size-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                title={phase === "frame" ? "重新生成脚本" : "生成分镜脚本"}
                onClick={() => void onSend()}
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </Pro2DockToolbar>
        </>
      }
    >
      <Pro2DockPasteZone
        anchorNodeId={storeNode.id}
        anchorNodeType="story-pro2-script-hub"
        disabled={isGenerating}
        maxImages={12}
      >
        <MentionsTextarea
          className={cn(
            PRO2_DOCK_TEXTAREA_CLASS,
            RF_FORM_CONTROL,
            RF_NO_WHEEL,
            "min-h-0 px-4 py-3",
          )}
          placeholder={`${placeholder}（输入 @ 引用大纲或参考图）`}
          value={dockInput}
          mentionables={mentionables}
          disabled={isGenerating}
          rows={3}
          mentionInlineThumb
          onChange={(value, _refs, meta) =>
            updateNodeData(storeNode.id, { dockInput: value }, {
              commit: meta?.commit ?? true,
            })
          }
        />
      </Pro2DockPasteZone>
    </Pro2InputDockShell>
  );
}
