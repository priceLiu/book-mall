"use client";

import { useCallback, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { ENGINE_PICKER_EMPTY_PARAMS } from "@/components/canvas/engine-picker";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import {
  optimisticLibtvMediaRunStart,
  revertOptimisticLibtvMediaRunStart,
} from "@/lib/canvas/libtv-image-node-run";
import { isLibtvMediaGenerating } from "@/components/canvas/libtv-media-generating-state";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import { LibtvDockSendButton } from "./libtv-dock-send-button";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  pickDefaultPro2TtsEngine,
} from "@/lib/canvas/kie-audio-models";
import type { LibtvAudioNodeData } from "@/lib/canvas/libtv-audio-task-apply";
import {
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2/pro2-input-dock-shell";
import {
  LibtvTtsDockModelPicker,
  LibtvTtsDockParamsPicker,
} from "./libtv-audio-dock-pickers";

/** Pro2 音频节点 · 底部浮动输入坞（ElevenLabs TTS） */
export function LibtvAudioInputDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);

  const dockNodeId = useLibtvSoleSelectedNodeId("story-pro2-audio");
  const storeNode = useMemo(() => {
    if (!dockNodeId) return null;
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);

  const { placement, hidden: dockHidden } = useLibtvFloatingDock(dockNodeId);

  const d = (storeNode?.data ?? {}) as LibtvAudioNodeData;
  const engine = d.engine ?? { providerId: "", modelKey: "", params: {} };
  const dockInput = String(d.dockInput ?? "");
  const isRunning = isLibtvMediaGenerating(d);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-audio",
      nodes,
      edges,
    );
  }, [storeNode, nodes, edges]);

  const mentionables = useMemo(
    () => buildPro2DockMentionables(upstreamLinks),
    [upstreamLinks],
  );

  const estCredits = useModelCreditsPreview(engine?.modelKey, 0);

  const { fontPx, sendIconPx } = useLibtvDockToolbarMetrics();

  const onPromptChange = useCallback(
    (value: string) => {
      if (!storeNode) return;
      updateNodeData(storeNode.id, { dockInput: value });
    },
    [storeNode, updateNodeData],
  );

  const onRun = useCallback(async () => {
    if (!storeNode || isRunning) return;
    optimisticLibtvMediaRunStart(storeNode.id, updateNodeData, setNodeRuntime);
    const revert = () =>
      revertOptimisticLibtvMediaRunStart(
        storeNode.id,
        updateNodeData,
        setNodeRuntime,
      );

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const live = useCanvasStore.getState().nodes.find((n) => n.id === storeNode.id);
    const liveData = (live?.data ?? {}) as LibtvAudioNodeData;
    const prompt = String(liveData.dockInput ?? "").trim();
    let runEngine = liveData.engine;
    if (!runEngine?.providerId?.trim()) {
      const seed = pickDefaultPro2TtsEngine(providers);
      if (seed) {
        runEngine = seed;
        updateNodeData(storeNode.id, { engine: seed });
      }
    }
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
      revert();
      await alert({
        title: "请选择模型",
        message: "请先在语音模型中选择 ElevenLabs V3 或 ElevenLabs Text to Speech。",
        variant: "warning",
      });
      return;
    }
    if (!prompt) {
      revert();
      await alert({
        title: "请输入提示词",
        message: "描述要合成的对白或旁白文本后再生成。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
      revert();
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    const queued = busEnqueueStoryRun({ nodeId: storeNode.id, forceFresh: true });
    if (!queued) {
      revert();
      await alert({
        title: "生成未能开始",
        message: "任务队列繁忙或上一任务仍在进行，请稍候再试。",
        variant: "warning",
      });
    }
  }, [
    storeNode,
    isRunning,
    providers,
    base,
    alert,
    updateNodeData,
    setNodeRuntime,
  ]);

  if (!storeNode || !placement) return null;

  const canSend = dockInput.trim().length > 0 && !isRunning;

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-audio-dock"
      hidden={dockHidden}
      footer={
        <Pro2DockToolbar className="gap-2">
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-0.5">
            <LibtvTtsDockModelPicker
              providerId={engine.providerId ?? ""}
              modelKey={engine.modelKey ?? ""}
              params={engine.params ?? ENGINE_PICKER_EMPTY_PARAMS}
              externalProviders={providers}
              disabled={isRunning}
              open={dockMenu === "model"}
              onOpenChange={(next) => setDockMenu(next ? "model" : null)}
              onChange={(next) => {
                updateNodeData(storeNode.id, { engine: next });
              }}
            />
            <LibtvTtsDockParamsPicker
              providerId={engine.providerId ?? ""}
              modelKey={engine.modelKey ?? ""}
              params={engine.params ?? ENGINE_PICKER_EMPTY_PARAMS}
              externalProviders={providers}
              disabled={isRunning}
              open={dockMenu === "params"}
              onOpenChange={(next) => setDockMenu(next ? "params" : null)}
              onChange={(nextParams) => {
                updateNodeData(storeNode.id, {
                  engine: {
                    providerId: engine.providerId ?? "",
                    modelKey: engine.modelKey ?? "",
                    params: nextParams,
                  },
                });
              }}
            />
          </div>
          <span className="ml-auto flex items-center gap-2 text-white/40">
            <Zap className="size-3.5" />
            <span style={{ fontSize: fontPx }}>
              {estCredits?.creditsLabel ?? estCredits?.credits ?? "—"}
            </span>
          </span>
          <LibtvDockSendButton
            disabled={!canSend}
            loading={isRunning}
            iconPx={sendIconPx}
            onClick={() => void onRun()}
          />
        </Pro2DockToolbar>
      }
    >
      <MentionsEditable
        className={cn(
          PRO2_DOCK_TEXTAREA_CLASS,
          RF_FORM_CONTROL,
          RF_NO_WHEEL,
          PRO2_DOCK_TEXTAREA_INSET_CLASS,
        )}
        placeholder="描述对白、旁白或配音风格；输入 @ 引用上游文本…"
        value={dockInput}
        mentionables={mentionables}
        disabled={isRunning}
        rows={3}
        mentionInlineThumb
        mentionInlineThumbHoverOnText
        mentionEdition="pro2"
        onChange={onPromptChange}
      />
    </Pro2InputDockShell>
  );
}
