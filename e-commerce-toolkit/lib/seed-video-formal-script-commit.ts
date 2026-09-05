import { syncSeedVideoPlan, updateSeedVideoProject } from "@/lib/ecom-seed-video-api";
import {
  serializeFormalScriptTable,
  type SeedVideoStoryboardDraftRow,
} from "@/lib/seed-video-storyboard-parse";
import type { SeedVideoChatMessage, SeedVideoProject } from "@/lib/seed-video-types";

/** 将分镜草稿一步转为正式脚本；预览写入 plan，等用户点「确认并同步」后再 planSynced */
export async function commitFormalScriptFromRows(
  project: SeedVideoProject,
  rows: SeedVideoStoryboardDraftRow[],
): Promise<SeedVideoProject> {
  const fineNeedsStyle =
    project.meta?.workflow?.productionMode === "fine" &&
    !project.meta?.workflow?.stylePreset &&
    !project.chatHistory.some(
      (m) => m.role === "user" && /^A方案：|^B方案：/.test(m.content.trim()),
    );
  if (fineNeedsStyle) {
    throw new Error("请先完成成片风格（A/B 方案）点选");
  }

  const md = serializeFormalScriptTable(rows);
  const userMsg: SeedVideoChatMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: md,
    createdAt: new Date().toISOString(),
  };

  await updateSeedVideoProject(project.id, {
    chatHistory: [...project.chatHistory, userMsg],
    meta: {
      storyboardDraft: rows,
      lastAssistantRaw: md,
      workflow: {
        ...(project.meta?.workflow ?? {}),
        editingStoryboard: false,
        phase: "shots",
        planSynced: false,
      },
    },
  });

  return syncSeedVideoPlan(project.id, {
    markdown: md,
    confirmSync: false,
  });
}
