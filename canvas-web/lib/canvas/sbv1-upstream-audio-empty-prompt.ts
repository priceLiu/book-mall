import type { ConfirmOptions } from "@/components/dialogs/dialog-provider";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  resolveSbv1UpstreamAudioLinks,
} from "./sbv1-upstream-audio-links";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Sbv1EmptyUpstreamAudioChoice =
  | "continue"
  | "generate-audio"
  | "cancel";

/** 预设快捷方式 · 已连音频节点但尚无 OSS URL */
export function sbv1HasEmptyUpstreamAudio(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  audioInputs: string[],
  pro2PresetKind: string,
): boolean {
  const preset = pro2PresetKind.trim();
  if (
    preset !== "reference-audio-to-video" &&
    preset !== "lip-sync-broadcast"
  ) {
    return false;
  }
  if (audioInputs.length > 0) return false;
  return resolveSbv1UpstreamAudioLinks(engineNodeId, nodes, edges).length > 0;
}

export async function promptSbv1EmptyUpstreamAudio(opts: {
  pro2PresetKind: string;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}): Promise<Sbv1EmptyUpstreamAudioChoice> {
  const preset = opts.pro2PresetKind.trim();
  if (preset === "lip-sync-broadcast") {
    const goAudio = await opts.confirm({
      title: "音频为空",
      message:
        "对口型口播需要上游台词音频。请先在音频节点选择音色并生成音频。",
      confirmLabel: "去生成音频",
      cancelLabel: "取消",
    });
    return goAudio ? "generate-audio" : "cancel";
  }
  const continueVideo = await opts.confirm({
    title: "音频为空",
    message:
      "上游参考音频尚未生成。可继续仅按参考图生成视频，或先去音频节点生成参考音频。",
    confirmLabel: "继续生成视频",
    cancelLabel: "生成音频",
  });
  return continueVideo ? "continue" : "generate-audio";
}

export function focusSbv1UpstreamAudioNode(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): boolean {
  const audioNodeId = resolveSbv1UpstreamAudioLinks(
    engineNodeId,
    nodes,
    edges,
  )[0]?.sourceNodeId;
  if (!audioNodeId) return false;
  const store = useCanvasStore.getState();
  selectPro2NodeAfterSpawn(store.setNodes, audioNodeId);
  store.setLibtvFloatingDockSelection(audioNodeId, "story-pro2-audio");
  return true;
}
