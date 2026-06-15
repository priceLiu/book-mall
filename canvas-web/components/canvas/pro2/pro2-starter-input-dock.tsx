"use client";

import { useCallback, useEffect, useMemo } from "react";
import { ArrowUp, Languages, Loader2, Zap } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { STORY_PRO2_THEME_OUTLINE_SYSTEM } from "@/lib/canvas/story-pro2-theme-outline-prompt";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
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
import { Pro2DockPasteZone } from "./pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";

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

  const placement = usePro2DockPlacement(selectedStarter?.id ?? null);
  const d = (storeNode?.data ?? {}) as StoryProStarterNodeData;
  const themeInput = d.themeInput ?? "";
  const isGenerating =
    d.themeOutlineRuntime?.status === "pending" ||
    d.themeOutlineRuntime?.status === "running";

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
    if (!d.providerId?.trim() || !d.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "点击左下角模型选择器，选择 LLM 后再发送。",
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
      starterMode: "generate",
      themeOutlineSystemPrompt: STORY_PRO2_THEME_OUTLINE_SYSTEM,
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
      },
    });
    busEnqueueStoryRun({
      nodeId: storeNode.id,
      mediaKind: "themeOutline",
      forceFresh: true,
    });
  }, [storeNode, themeInput, d.providerId, d.modelKey, base, alert, updateNodeData]);

  if (!storeNode || !placement) return null;

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-starter-dock"
      header={
        <Pro2DockContextBar>
          <Pro2DockUpstreamChips
            links={upstreamLinks}
            anchorNodeId={storeNode.id}
            activeIds={activeRefIds}
          />
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
                className="nodrag rounded-md p-1.5 text-white/35 hover:bg-white/6 hover:text-white/60"
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
                disabled={isGenerating || !themeInput.trim()}
                className="nodrag flex size-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                title="生成故事大纲"
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
        anchorNodeType="story-pro2-starter"
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
          placeholder="写下你想讲的故事、场景或角色设定。输入 @ 可引用已链接的图片。"
          value={themeInput}
          mentionables={mentionables}
          disabled={isGenerating}
          rows={3}
          onChange={(value) =>
            updateNodeData(storeNode.id, { themeInput: value })
          }
        />
      </Pro2DockPasteZone>
    </Pro2InputDockShell>
  );
}
