"use client";

import type { NodeProps } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { TtsEngineNodeData } from "@/lib/canvas/types";
import { STORY_TTS_MODEL_KEYS } from "@/lib/canvas/types";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { EnginePreviewTrigger } from "../engine-preview-trigger";
import {
  NODE_MEDIA_MIN_WIDTH,
  NODE_PROMPT_CLASS,
  NodeEngineFooter,
  NodeEngineLayout,
  NodeEngineShellFooter,
} from "../node-ui";

export function TtsEngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as TtsEngineNodeData;
  const audioUrl = d.runtime?.ossUrl;
  const hasGenerated = Boolean(audioUrl) || d.runtime?.status === "done";
  const isGenerating =
    d.runtime?.status === "running" || d.runtime?.status === "pending";

  const onRun = (forceFresh: boolean) => {
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", { detail: { nodeId: id, forceFresh } }),
    );
  };

  return (
    <NodeShell
      title={d.frameIndex ? `配音 · 镜${d.frameIndex}` : "TTS 配音"}
      subtitle={d.modelKey || "OpenAI 兼容 TTS"}
      selected={selected}
      engine
      minWidth={NODE_MEDIA_MIN_WIDTH}
      minHeight={360}
      inputs={[{ id: "in_text", label: "台词", kind: "text" }]}
      outputs={[{ id: "audio", label: "音频", kind: "text" }]}
      headerRight={
        <EnginePreviewTrigger
          title={d.frameIndex ? `配音 · 镜${d.frameIndex}` : "TTS 配音"}
          kind="audio"
          mediaUrl={audioUrl}
          status={d.runtime?.status}
          failMessage={d.runtime?.failMessage}
        />
      }
      footer={
        <NodeEngineShellFooter
          hint="台词来自分镜表或手动编辑"
          tag="TTS"
        />
      }
    >
      <NodeEngineLayout
        engineFooter={
          <NodeEngineFooter
            picker={
              <EnginePicker
                role="LLM"
                allowedModelKeys={[...STORY_TTS_MODEL_KEYS]}
                providerId={d.providerId ?? ""}
                modelKey={d.modelKey ?? ""}
                params={d.params ?? {}}
                onChange={(next) =>
                  updateNodeData(id, {
                    providerId: next.providerId,
                    modelKey: next.modelKey,
                    params: next.params,
                  })
                }
              />
            }
            runLabel="合成"
            runAgainLabel="重新合成"
            isGenerating={isGenerating}
            hasGenerated={hasGenerated}
            runDisabled={!d.providerId || !d.modelKey}
            onRun={() => onRun(hasGenerated)}
          />
        }
      >
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <textarea
          className={`nodrag shrink-0 ${NODE_PROMPT_CLASS}`}
          value={d.text ?? ""}
          placeholder="本镜台词（可从分镜表 batch 填入）"
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
        />
        {audioUrl ? (
          <audio src={audioUrl} controls className="w-full shrink-0" />
        ) : null}
      </div>
      </NodeEngineLayout>
    </NodeShell>
  );
}
