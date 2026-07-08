/**
 * Pro2 / LibTV 音频节点 runner（KIE ElevenLabs TTS · Suno 音乐）
 */
import { CanvasProjectError } from "./canvas-project-service";
import {
  runKieAudioEngineNode,
  type RunEngineNodeArgs,
  type RunEngineNodeResult,
} from "./canvas-engine-runner";

export async function runPro2AudioNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const engine = (data.engine as Record<string, unknown> | undefined) ?? {};
  const providerId = String(
    engine.providerId ?? data.providerId ?? "",
  ).trim();
  const modelKey = String(engine.modelKey ?? data.modelKey ?? "").trim();
  const prompt = String(data.dockInput ?? data.prompt ?? "").trim();
  const upstreamText = (args.node.textInputs ?? []).filter((s) => s?.trim());
  const mergedPrompt = [prompt, ...upstreamText].filter(Boolean).join("\n\n");

  if (!providerId || !modelKey) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "音频节点缺少模型配置，请在 Dock 选择 TTS / 音乐模型",
    );
  }
  if (!mergedPrompt.trim()) {
    throw new CanvasProjectError("EMPTY_PROMPT", "音频节点提示词为空");
  }

  const params =
    (engine.params as Record<string, unknown> | undefined) ??
    (data.params as Record<string, unknown> | undefined) ??
    {};

  return runKieAudioEngineNode({
    ...args,
    node: {
      ...args.node,
      type: "audio-engine",
      data: {
        ...data,
        providerId,
        modelKey,
        prompt: mergedPrompt,
        params,
      },
    },
  });
}
