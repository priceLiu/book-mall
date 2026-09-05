import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import type { Pro2ProductionScriptShot } from "@/lib/canvas/pro2-production-wizard-assets";

export type Pro2WizardShotMediaKind = "frame" | "video";

export type Pro2ProductionWizardShotDraft = {
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
  prompt?: string;
  refImages?: StoryRefImage[];
  providerId?: string;
  modelKey?: string;
  params?: Record<string, unknown>;
  /** 分镜图/视频预览 URL */
  previewUrl?: string;
  generateStatus?: "idle" | "running" | "failed";
  taskId?: string;
  failMessage?: string;
  /** 视频生成时依赖的分镜图 draft preview（只读缓存） */
  framePreviewUrl?: string;
};

export function wizardShotDraftKey(
  mediaKind: Pro2WizardShotMediaKind,
  shotIndex: number,
): string {
  return `${mediaKind}:${shotIndex}`;
}

export function parseWizardShotDraftKey(key: string): {
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
} | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const mediaKind = key.slice(0, idx) as Pro2WizardShotMediaKind;
  if (mediaKind !== "frame" && mediaKind !== "video") return null;
  const shotIndex = Number.parseInt(key.slice(idx + 1), 10);
  if (!Number.isFinite(shotIndex) || shotIndex <= 0) return null;
  return { mediaKind, shotIndex };
}

export function shotRowKey(shotIndex: number): string {
  return String(shotIndex);
}

function dialogueLine(dialogue?: string): string {
  const d = dialogue?.trim();
  if (!d || d === "—" || d === "-") return "";
  return `对白：${d}`;
}

function buildWizardVideoFallbackPrompt(shot: Pro2ProductionScriptShot): string {
  const parts = [
    `镜 ${shot.index}`,
    shot.shotSize?.trim() ? `景别：${shot.shotSize.trim()}` : "",
    shot.lighting?.trim() ? `光影：${shot.lighting.trim()}` : "",
    shot.cameraMove?.trim() ? `运镜：${shot.cameraMove.trim()}` : "",
    shot.sceneDescription?.trim()
      ? `画面：${shot.sceneDescription.trim()}`
      : "",
    dialogueLine(shot.dialogue),
    shot.sfxNote?.trim() ? `音效：${shot.sfxNote.trim()}` : "",
    shot.audioNote?.trim() ? `口型：${shot.audioNote.trim()}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

/** Step3 默认提示词：优先 Pass2，否则从 Pass1 字段拼装 */
export function defaultWizardShotPrompt(
  mediaKind: Pro2WizardShotMediaKind,
  shot: Pro2ProductionScriptShot,
): string {
  if (mediaKind === "frame") {
    const pass2 =
      shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
    if (pass2) return pass2;
    const parts = [
      `镜 ${shot.index}`,
      shot.shotSize?.trim() ? `景别：${shot.shotSize.trim()}` : "",
      shot.lighting?.trim() ? `光影：${shot.lighting.trim()}` : "",
      shot.sceneDescription?.trim()
        ? `镜头描述：${shot.sceneDescription.trim()}`
        : "",
      dialogueLine(shot.dialogue),
    ].filter(Boolean);
    return parts.join("\n");
  }
  const pass2 = shot.videoPrompt?.trim() || "";
  if (pass2) return pass2;
  return buildWizardVideoFallbackPrompt(shot);
}

export function resolveWizardShotFromScript(
  script: Pro2ProductionScript | undefined,
  shotIndex: number,
): Pro2ProductionScriptShot | undefined {
  return script?.shots?.find((s) => s.index === shotIndex);
}

export const WIZARD_SHOT_MEDIA_LABEL: Record<Pro2WizardShotMediaKind, string> = {
  frame: "分镜图",
  video: "分镜视频",
};

export const WIZARD_SHOT_PLACEHOLDER: Record<Pro2WizardShotMediaKind, string> = {
  frame: "点击 ✨ 编辑提示词并生成分镜图",
  video: "需先有分镜图 · 点击 ✨ 生成分镜视频",
};
