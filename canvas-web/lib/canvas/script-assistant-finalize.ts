import { clearScriptAssistantHistory } from "@/lib/canvas-api";

/** 故事定稿时由 hub 节点调用（勿从 script-writing-assistant-panel 静态 import，避免拖入整面板 chunk） */
export async function clearScriptAssistantOnFinalize(
  base: string,
  projectId: string,
  scriptHubId: string,
  starterId?: string,
): Promise<void> {
  try {
    await clearScriptAssistantHistory(base, projectId, scriptHubId);
    if (starterId) {
      await clearScriptAssistantHistory(
        base,
        projectId,
        `starter:${starterId}`,
      );
    }
  } catch {
    /* ignore */
  }
}
