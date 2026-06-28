import { uploadCanvasFile } from "@/lib/canvas-api";
import {
  formatCanvasFetchError,
  parseStoryProUploadScriptFile,
} from "./story-pro-upload-script";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import { enqueuePro2ScriptGeneration } from "./pro2-script-hub-helpers";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Pro2HubScriptUploadStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

export type Pro2HubScriptUploadDialogs = {
  alert: (args: {
    title: string;
    message: string;
    variant?: "error" | "warning" | "info";
  }) => Promise<void>;
};

/** 脚本生成器 hub · 上传剧本；可选触发生成分镜脚本 */
export async function ingestPro2HubScriptFile(
  hubId: string,
  file: File,
  base: string,
  store: Pro2HubScriptUploadStore,
  dialogs: Pro2HubScriptUploadDialogs,
  opts?: { triggerGeneration?: boolean },
): Promise<boolean> {
  if (!base.trim()) {
    await dialogs.alert({
      title: "画布未就绪",
      message: "请刷新页面后重试。",
      variant: "error",
    });
    return false;
  }

  try {
    const parsed = await parseStoryProUploadScriptFile(file);
    if (!parsed.ok) {
      await dialogs.alert({
        title: "无法解析剧本",
        message: parsed.error,
        variant: "error",
      });
      return false;
    }

    const blob = new Blob([parsed.md], {
      type:
        parsed.meta.format === "txt"
          ? "text/plain;charset=utf-8"
          : "text/markdown;charset=utf-8",
    });
    const uploadFile = new File([blob], parsed.meta.fileName, {
      type: blob.type,
    });
    const ossUrl = await uploadCanvasFile(base, uploadFile);

    const live = store.nodes.find((n) => n.id === hubId);
    const hubData = (live?.data ?? {}) as StoryProScriptHubNodeData;
    const patch: Record<string, unknown> = {
      uploadedScriptMd: parsed.md,
      uploadedScriptOssUrl: ossUrl,
      uploadedScriptMeta: parsed.meta,
      outlineMd: parsed.md,
      scriptStudioInputMode: "upload",
      scriptStudioThemeInput: parsed.md.slice(0, 4000),
    };

    store.updateNodeData(hubId, patch);

    if (opts?.triggerGeneration !== false) {
      const nextHub: StoryProScriptHubNodeData = { ...hubData, ...patch };
      enqueuePro2ScriptGeneration(hubId, "", [], store.updateNodeData, {
        forceFresh: true,
        nodes: store.nodes,
        edges: store.edges,
        hubData: nextHub,
        regenerateAll: true,
      });
    }
    return true;
  } catch (e) {
    await dialogs.alert({
      title: "上传失败",
      message: formatCanvasFetchError(e, "剧本上传云端失败"),
      variant: "error",
    });
    return false;
  }
}
