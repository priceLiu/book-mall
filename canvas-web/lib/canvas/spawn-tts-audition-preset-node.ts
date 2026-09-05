import {
  engineFromTtsAuditionPreset,
  type CanvasTtsAuditionPreset,
} from "@/lib/canvas/libtv-tts-audition-presets";
import { buildPro2AudioNodeData } from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import type { CanvasNodeType } from "@/lib/canvas/types";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";

/** 已试听 Tab · 在视口中心生成预填 engine 的音频节点 */
export function spawnTtsAuditionPresetAudioNode(
  preset: CanvasTtsAuditionPreset,
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string,
): string {
  const position =
    flowPositionAtViewportCenter("story-pro2-audio") ?? { x: 420, y: 280 };
  const engine = engineFromTtsAuditionPreset(preset);
  return addNode(
    "story-pro2-audio",
    position,
    buildPro2AudioNodeData({
      label: preset.label.trim() || preset.voiceLabel || "音频",
      dockInput: preset.sampleText?.trim() ?? "",
      engine,
    }),
  );
}

export function spawnAndSelectTtsAuditionPresetAudioNode(
  preset: CanvasTtsAuditionPreset,
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string,
  setNodes: (
    updater: (nodes: import("@/lib/canvas/types").CanvasFlowNode[]) => import("@/lib/canvas/types").CanvasFlowNode[],
  ) => void,
): string {
  const nodeId = spawnTtsAuditionPresetAudioNode(preset, addNode);
  if (nodeId) selectPro2NodeAfterSpawn(setNodes, nodeId);
  return nodeId;
}
