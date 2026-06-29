import { publishScriptHubCrewBulletin } from "./crew-bulletin-build";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

export type Pro2PublishScriptDialogs = {
  alert: (args: {
    title: string;
    message: string;
    variant?: "error" | "warning" | "info";
  }) => Promise<void>;
  confirm: (args: {
    title: string;
    message: string;
  }) => Promise<boolean>;
};

/** 脚本 hub · 确认后发布剧组公告条 */
export async function confirmAndPublishPro2ScriptHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  dialogs: Pro2PublishScriptDialogs,
  opts?: { publishedBy?: string; requireBatch?: boolean; batchIndex?: number },
): Promise<Record<string, unknown> | null> {
  const hasOutline = Boolean(hubData.outlineMd?.trim());
  const hasStoryboard = Boolean(hubData.storyboardMd?.trim());
  const batchIndex = opts?.batchIndex ?? hubData.scriptStudioBatchIndex ?? 0;
  const requireBatch = opts?.requireBatch ?? hubData.scriptStudioMode === true;

  if (!hasOutline && !hasStoryboard && (requireBatch ? batchIndex <= 0 : true)) {
    await dialogs.alert({
      title: "暂无剧本",
      message: requireBatch
        ? "请先生成至少一批工业化剧本后再发布。"
        : "请先生成或上传剧本后再发布。",
      variant: "warning",
    });
    return null;
  }

  if (
    !(await dialogs.confirm({
      title: "发布剧本",
      message:
        "发布后剧组可在公告条参与制作角色、场景、道具、分镜等任务；发布者也可参与并执行。是否继续？",
    }))
  ) {
    return null;
  }

  return publishScriptHubCrewBulletin(hubId, hubData, {
    publishedBy: opts?.publishedBy,
  });
}
