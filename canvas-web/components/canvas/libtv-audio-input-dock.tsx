"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useLibtvShouldSuppressFloatingDock } from "@/lib/canvas/libtv-floating-dock-selection";
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
import { LibtvDockCreditsLabel } from "./libtv-dock-credits-label";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  pickDefaultPro2TtsEngine,
  DEFAULT_LIBTV_MINIMAX_VOICE_ID,
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
import { LibtvTtsDockVoicePicker } from "./libtv-tts-voice-picker";
import { LibtvQrAudioDockModelPicker } from "./libtv-qr-audio-dock-model-picker";
import {
  fetchLibtvQrAudioCatalog,
} from "@/lib/canvas/libtv-qr-audio-catalog-client";
import {
  isMinimaxSpeechModelKey,
  pickDefaultQrVoiceoverEngine,
} from "@/lib/canvas/libtv-qr-audio-models";
import { isQwen3TtsModelKey } from "@/lib/canvas/qwen3-tts-voice-catalog";
import { LIBTV_TTS_VOICE_CONTROL_DEFAULTS } from "@/lib/canvas/libtv-tts-voice-controls-schema";
import { LibtvQwenTtsDockVoicePicker } from "./libtv-qwen-tts-voice-picker";
import {
  mergeLibtvAudioRunText,
  resolveLibtvAudioPredecessorTexts,
} from "@/lib/canvas/libtv-audio-run-text";

/** Pro2 音频节点 · 底部浮动输入坞（ElevenLabs TTS） */
export function LibtvAudioInputDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  const [dockMenu, setDockMenu] = useState<"model" | "params" | "voice" | null>(null);

  const dockNodeId = useLibtvSoleSelectedNodeId("story-pro2-audio");
  const suppressDock = useLibtvShouldSuppressFloatingDock();
  const storeNode = useMemo(() => {
    if (!dockNodeId) return null;
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);

  useEffect(() => {
    setDockMenu(null);
  }, [dockNodeId]);

  const { placement, hidden: dockHidden } = useLibtvFloatingDock(dockNodeId);

  const d = (storeNode?.data ?? {}) as LibtvAudioNodeData & {
    pro2PresetKind?: string;
  };
  const engine = d.engine ?? { providerId: "", modelKey: "", params: {} };
  const isLipSyncPreset = String(d.pro2PresetKind ?? "") === "lip-sync-broadcast";
  const isRefAudioPreset =
    String(d.pro2PresetKind ?? "") === "reference-audio-to-video";
  const isQrVoicePreset = isLipSyncPreset || isRefAudioPreset;
  const isMinimaxEngine = isMinimaxSpeechModelKey(engine.modelKey ?? "");
  const isQwenEngine = isQwen3TtsModelKey(engine.modelKey ?? "");
  const voiceId = String(engine.params?.voice_id ?? engine.params?.voice ?? "");
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

  const effectiveText = useMemo(() => {
    if (!storeNode) return "";
    return mergeLibtvAudioRunText(
      dockInput,
      upstreamLinks,
      resolveLibtvAudioPredecessorTexts(nodes, edges, storeNode.id),
    );
  }, [storeNode, dockInput, upstreamLinks, nodes, edges]);

  const resolvedVoiceId = isQwenEngine
    ? String(engine.params?.voice ?? voiceId).trim()
    : voiceId.trim();

  const estCredits = useModelCreditsPreview(engine?.modelKey, 0);

  const { fontPx } = useLibtvDockToolbarMetrics();

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
    const liveLinks = resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-audio",
      useCanvasStore.getState().nodes,
      useCanvasStore.getState().edges,
    );
    const mergedText = mergeLibtvAudioRunText(
      String(liveData.dockInput ?? ""),
      liveLinks,
      resolveLibtvAudioPredecessorTexts(
        useCanvasStore.getState().nodes,
        useCanvasStore.getState().edges,
        storeNode.id,
      ),
    );
    let runEngine = liveData.engine;
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
      if (isQrVoicePreset && base) {
        try {
          const catalog = await fetchLibtvQrAudioCatalog(base);
          const seed = pickDefaultQrVoiceoverEngine(catalog.models, {
            modelKey: catalog.defaults.modelKey,
            voiceId: catalog.defaults.voiceId,
          });
          if (seed) {
            runEngine = seed;
            updateNodeData(storeNode.id, { engine: seed });
          }
        } catch {
          /* fall through */
        }
      }
      if (!runEngine?.providerId?.trim()) {
        const seed = pickDefaultPro2TtsEngine(providers);
        if (seed) {
          runEngine = seed;
          updateNodeData(storeNode.id, { engine: seed });
        }
      }
    }
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
      revert();
      await alert({
        title: "请选择模型",
        message: isQrVoicePreset
          ? "请先在 Dock 选择快速复制旁白模型（MiniMax / ElevenLabs）。"
          : "请先在语音模型中选择 Qwen3 TTS、ElevenLabs 或其它 Gateway TTS 模型。",
        variant: "warning",
      });
      return;
    }
    const runIsMinimax = isMinimaxSpeechModelKey(runEngine.modelKey ?? "");
    const runIsQwen = isQwen3TtsModelKey(runEngine.modelKey ?? "");
    if (
      (runIsMinimax || runIsQwen) &&
      !String(
        runEngine.params?.voice_id ??
          runEngine.params?.voice ??
          "",
      ).trim()
    ) {
      revert();
      await alert({
        title: "请选择音色",
        message: isQrVoicePreset && isLipSyncPreset
          ? "对口型口播需要先在 Dock 选择音色，再输入台词生成音频。"
          : "请先在 Dock 选择音色后再生成对白。",
        variant: "warning",
      });
      return;
    }
    if (!mergedText) {
      revert();
      await alert({
        title: "请输入旁白",
        message: "在 Dock 输入对白，或连接上游文本节点 / 使用 @ 引用台词后再生成。",
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
    isMinimaxEngine,
    isQwenEngine,
    isQrVoicePreset,
    isLipSyncPreset,
    providers,
    base,
    alert,
    updateNodeData,
    setNodeRuntime,
  ]);

  if (suppressDock || !storeNode || !placement) return null;

  const canSend =
    effectiveText.length > 0 &&
    !isRunning &&
    (!isMinimaxEngine && !isQwenEngine ? true : Boolean(resolvedVoiceId));

  return (
    <Pro2InputDockShell
      key={storeNode.id}
      flowAnchor={placement}
      dockClassName="pro2-audio-dock"
      hidden={dockHidden}
      anchorNodeId={storeNode.id}
      footer={
        <Pro2DockToolbar className="gap-2">
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-0.5">
            {isRefAudioPreset ? (
              <LibtvQrAudioDockModelPicker
                modelKey={engine.modelKey ?? ""}
                voiceId={voiceId}
                disabled={isRunning}
                open={dockMenu === "model"}
                onOpenChange={(next) => setDockMenu(next ? "model" : null)}
                onChange={(next) => {
                  updateNodeData(storeNode.id, { engine: next });
                }}
              />
            ) : !isLipSyncPreset ? (
              <LibtvTtsDockModelPicker
                providerId={engine.providerId ?? ""}
                modelKey={engine.modelKey ?? ""}
                params={engine.params ?? ENGINE_PICKER_EMPTY_PARAMS}
                externalProviders={providers}
                disabled={isRunning}
                open={dockMenu === "model"}
                onOpenChange={(next) => setDockMenu(next ? "model" : null)}
                onChange={(next) => {
                  const prevKey = engine.modelKey ?? "";
                  const nextKey = next.modelKey ?? "";
                  let params = { ...(engine.params ?? {}), ...(next.params ?? {}) };
                  if (
                    isMinimaxSpeechModelKey(nextKey) &&
                    !isMinimaxSpeechModelKey(prevKey)
                  ) {
                    params = {
                      voice_id: DEFAULT_LIBTV_MINIMAX_VOICE_ID,
                      speed: LIBTV_TTS_VOICE_CONTROL_DEFAULTS.speed,
                      vol: LIBTV_TTS_VOICE_CONTROL_DEFAULTS.vol,
                      pitch: LIBTV_TTS_VOICE_CONTROL_DEFAULTS.pitch,
                    };
                  } else if (
                    isQwen3TtsModelKey(nextKey) &&
                    !isQwen3TtsModelKey(prevKey)
                  ) {
                    params = {
                      voice: "Cherry",
                      language_type: "Chinese",
                    };
                  }
                  updateNodeData(storeNode.id, {
                    engine: {
                      providerId: next.providerId,
                      modelKey: next.modelKey,
                      params,
                    },
                  });
                }}
              />
            ) : null}
            {isMinimaxEngine ? (
              <LibtvTtsDockVoicePicker
                voiceId={voiceId}
                disabled={isRunning}
                open={dockMenu === "voice"}
                onOpenChange={(next) => setDockMenu(next ? "voice" : null)}
                onSelectVoice={(nextVoiceId) => {
                  updateNodeData(storeNode.id, {
                    engine: {
                      providerId: engine.providerId ?? "",
                      modelKey: engine.modelKey ?? "",
                      params: {
                        ...(engine.params ?? {}),
                        voice_id: nextVoiceId,
                      },
                    },
                  });
                }}
              />
            ) : isQwenEngine ? (
              <>
                <LibtvQwenTtsDockVoicePicker
                  voiceId={String(engine.params?.voice ?? voiceId)}
                  disabled={isRunning}
                  open={dockMenu === "voice"}
                  onOpenChange={(next) => setDockMenu(next ? "voice" : null)}
                  onSelectVoice={(nextVoiceId) => {
                    updateNodeData(storeNode.id, {
                      engine: {
                        providerId: engine.providerId ?? "",
                        modelKey: engine.modelKey ?? "",
                        params: {
                          ...(engine.params ?? {}),
                          voice: nextVoiceId,
                        },
                      },
                    });
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
              </>
            ) : null}
            {isMinimaxEngine && !isQrVoicePreset ? (
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
            ) : null}
          </div>
          <LibtvDockCreditsLabel
            credits={estCredits?.credits}
            fontPx={fontPx}
          />
          <LibtvDockSendButton
            disabled={!canSend}
            loading={isRunning}
            title={isRunning ? "生成中" : "生成音频"}
            onClick={() => void onRun()}
          />
        </Pro2DockToolbar>
      }
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
        placeholder="输入旁白或对白；输入 @ 引用上游文本…"
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
