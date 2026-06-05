import type { StoryboardProject, StoryboardReference } from "@/lib/storyboard-types";

export type StoryboardUploadRole = "product" | "character" | "scene";

function userSaid(project: StoryboardProject, texts: string[]): boolean {
  return project.chatHistory.some(
    (m) =>
      m.role === "user" &&
      texts.some((t) => m.content.trim() === t || m.content.includes(t)),
  );
}

export function hasStoryboardProductRef(project: StoryboardProject): boolean {
  return project.references.some((r) => r.role === "product");
}

export function planModeChosen(project: StoryboardProject): boolean {
  return userSaid(project, ["按默认方案A", "自定义参数"]);
}

export function productRefStepDone(project: StoryboardProject): boolean {
  return hasStoryboardProductRef(project);
}

export function characterRefStepDone(project: StoryboardProject): boolean {
  const wf = project.meta?.workflow ?? {};
  return (
    userSaid(project, ["已上传角色图"]) ||
    Boolean(wf.autoGenCharacter) ||
    Boolean(wf.skippedCharacter)
  );
}

export function sceneRefStepDone(project: StoryboardProject): boolean {
  const wf = project.meta?.workflow ?? {};
  return userSaid(project, ["已上传场景图", "已上传参考图"]) || Boolean(wf.skippedRefs);
}

/** @deprecated 使用 sceneRefStepDone */
export function otherRefStepDone(project: StoryboardProject): boolean {
  return sceneRefStepDone(project);
}

/** 当前应收参考图的类型（用户点「已上传」前可连续上传多张） */
export function inferCollectUploadRole(project: StoryboardProject): StoryboardUploadRole {
  if (!productRefStepDone(project)) return "product";
  if (!characterRefStepDone(project)) return "character";
  if (!sceneRefStepDone(project)) return "scene";
  return "scene";
}

/** @deprecated 使用 inferCollectUploadRole */
export function inferNextUploadRole(
  project: StoryboardProject,
): StoryboardReference["role"] {
  return inferCollectUploadRole(project);
}

/** 各镜头分镜图均已生成（与右侧分镜图区一致） */
export function hasAllPanelImages(project: StoryboardProject): boolean {
  const panels = project.sheet?.panels ?? [];
  return panels.length > 0 && panels.every((p) => Boolean(p.imageUrl));
}

/** 分镜图阶段完成：全部镜头有图，或已合成完整分镜 PNG */
export function hasSheetImagesReady(project: StoryboardProject): boolean {
  return hasAllPanelImages(project) || Boolean(project.sheetPngUrl);
}

export function panelVideoCount(project: StoryboardProject): number {
  return project.sheet?.panels.filter((p) => Boolean(p.videoUrl)).length ?? 0;
}

export function inferAssistantChoices(project: StoryboardProject): string[] {
  if (project.meta?.workflow?.replanning) return [];

  const hasSheet = Boolean(project.sheet);
  const hasAnalysis = Boolean(project.meta?.deliverable?.analysis);
  const hasSchemes = Boolean(project.meta?.deliverable?.schemes?.length);
  const imagesReady = hasSheetImagesReady(project);
  const hasVideo = Boolean(project.videoAssetId);

  if (!planModeChosen(project) && !hasAnalysis && !hasSchemes && !hasSheet) {
    return ["按默认方案A", "自定义参数"];
  }

  if ((hasAnalysis || hasSchemes || planModeChosen(project)) && !hasSheet) {
    if (!productRefStepDone(project)) return ["已上传产品图"];
    if (!characterRefStepDone(project)) {
      return ["已上传角色图", "跳过", "是，自动生成角色"];
    }
    if (!sceneRefStepDone(project)) return ["已上传场景图", "跳过"];
    return ["无需微调", "定稿"];
  }

  if (hasSheet && !imagesReady) return ["生成全部分镜图", "重新定方案"];
  if (imagesReady && !hasVideo) {
    const choices = ["生成整图成片"];
    if (panelVideoCount(project) >= 2) choices.push("合并分镜视频");
    return choices;
  }
  return [];
}

/** 助手区点击后打开右侧生图模型选择，不向助手发消息 */
export const STORYBOARD_GENERATE_ALL_IMAGES_CHOICE = "生成全部分镜图";

export function isGenerateAllImagesChoice(text: string): boolean {
  return text === STORYBOARD_GENERATE_ALL_IMAGES_CHOICE || text === "开始生成分镜图";
}

/** 助手区点击后打开右侧视频模型选择（整图成片） */
export const STORYBOARD_GENERATE_FULL_VIDEO_CHOICE = "生成整图成片";

export function isGenerateFullVideoChoice(text: string): boolean {
  return text === STORYBOARD_GENERATE_FULL_VIDEO_CHOICE;
}

/** 助手区点击后直接触发分镜视频合并 */
export const STORYBOARD_MERGE_PANEL_VIDEOS_CHOICE = "合并分镜视频";

export function isMergePanelVideosChoice(text: string): boolean {
  return text === STORYBOARD_MERGE_PANEL_VIDEOS_CHOICE;
}

export function workflowPatchForChoice(
  project: StoryboardProject,
  text: string,
): Record<string, unknown> | null {
  if (text === "跳过") {
    if (!productRefStepDone(project)) return null;
    if (!characterRefStepDone(project)) return { skippedCharacter: true };
    if (!sceneRefStepDone(project)) return { skippedRefs: true };
  }
  if (text === "是，自动生成角色") return { autoGenCharacter: true };
  if (text === "定稿" || text === "无需微调") return { replanning: false, phase: "refs" };
  if (text === "wan2.7-image" || text === "通义万相 2.7") return { imageModelKey: "wan2.7-image" };
  if (text === "wan2.7-image-pro" || text === "通义万相 2.7 Pro")
    return { imageModelKey: "wan2.7-image-pro" };
  if (
    text === "wan2.6-image" ||
    text === "wan2.6-t2i" ||
    text === "通义万相 2.6"
  ) {
    return { imageModelKey: "wan2.6-image" };
  }
  if (
    text === "kling-3.0-image" ||
    text === "可灵 3.0" ||
    text === "Kling 3.0"
  ) {
    return { imageModelKey: "kling-3.0-image" };
  }
  if (
    text === "nano-banana-pro" ||
    text === "Nano Banana Pro" ||
    text === "nanobanana" ||
    text === "nano banana"
  ) {
    return { imageModelKey: "nano-banana-pro" };
  }
  if (text === "doubao-seedance-2.0") return { videoModelKey: "doubao-seedance-2.0" };
  if (
    text === "bytedance/seedance-2" ||
    text === "seedance-2" ||
    text === "Seedance 2" ||
    text === "Seedance 2 (KIE)"
  ) {
    return { videoModelKey: "bytedance/seedance-2" };
  }
  if (
    text === "kling-3.0/video" ||
    text === "kling 3.0" ||
    text === "可灵 3.0" ||
    text === "Kling 3.0"
  ) {
    return { videoModelKey: "kling-3.0/video" };
  }
  if (
    text === "happyhorse-1.0-r2v" ||
    text === "HappyHorse R2V" ||
    text === "happy horse 1.0 R2v"
  ) {
    return { videoModelKey: "happyhorse-1.0-r2v" };
  }
  if (text === "wan2.7-r2v" || text === "万相 2.7 参考生视频" || text === "万相2.7-r2v") {
    return { videoModelKey: "wan2.7-r2v" };
  }
  if (text === "wan2.6-r2v" || text === "万相 2.6 参考生视频" || text === "wan 2.6-r2v") {
    return { videoModelKey: "wan2.6-r2v" };
  }
  if (
    text === "wan2.6-r2v-flash" ||
    text === "万相 2.6 R2V Flash" ||
    text === "万相 2.6 Flash"
  ) {
    return { videoModelKey: "wan2.6-r2v-flash" };
  }
  return null;
}
