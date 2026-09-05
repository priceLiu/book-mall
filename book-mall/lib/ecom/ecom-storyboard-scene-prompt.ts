import { getStoryboardSceneRefs } from "@/lib/ecom/ecom-storyboard-refs";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";

export type PanelSceneFields = {
  scene?: string;
  scenePrompt?: string;
};

export type PanelScenePromptContext = {
  scenePresetKey?: string;
  scenePresetLabel?: string;
  scenePresetImageHint?: string;
  /** 全片场景锚点（服装七维 customScene / 策划 creativeBrief 等） */
  globalSceneAnchor?: string;
};

const SCENE_REF_PRIMARY =
  "背景、光线、空间布局与道具须与用户上传的场景参考图一致";
const SCENE_REF_LOCAL_PREFIX = "本镜机位与局部变化";

function isPlaceholderScene(text?: string): boolean {
  const s = text?.trim();
  return !s || s === "—" || s === "场景";
}

/** 从 sceneDesc / scene 推导 scenePrompt（legacy 数据兼容） */
export function derivePanelScenePrompt(
  panel: PanelSceneFields,
  globalSceneAnchor?: string,
): string {
  const explicit = panel.scenePrompt?.trim();
  if (explicit && explicit.length >= 20) return explicit;

  const scene = panel.scene?.trim();
  const anchor = globalSceneAnchor?.trim();
  if (!isPlaceholderScene(scene)) {
    if (anchor && !scene!.includes(anchor)) {
      return `${anchor}，${scene}`;
    }
    return scene!;
  }
  if (anchor) return anchor;
  return explicit ?? "";
}

/**
 * 解析单镜场景文本，供生图与生视频共用。
 * 用户上传场景参考图时：参考图优先，scenePrompt 仅描述机位/局部差异。
 */
export function resolvePanelSceneText(
  panel: PanelSceneFields,
  references: StoryboardReference[],
  ctx?: PanelScenePromptContext,
): string {
  const sceneRefs = getStoryboardSceneRefs(references);
  const panelScenePrompt = panel.scenePrompt?.trim();
  const panelScene = panel.scene?.trim();
  const globalAnchor = ctx?.globalSceneAnchor?.trim();

  if (sceneRefs.length > 0) {
    const local =
      panelScenePrompt ||
      (!isPlaceholderScene(panelScene) ? panelScene : undefined);
    if (local) {
      return `${SCENE_REF_PRIMARY}；${SCENE_REF_LOCAL_PREFIX}：${local}`;
    }
    return SCENE_REF_PRIMARY;
  }

  if (panelScenePrompt) return panelScenePrompt;

  if (!isPlaceholderScene(panelScene)) {
    if (globalAnchor && !panelScene!.includes(globalAnchor)) {
      return `${globalAnchor}，${panelScene}`;
    }
    return panelScene!;
  }

  if (ctx?.scenePresetImageHint?.trim()) {
    return ctx.scenePresetImageHint.trim();
  }
  if (globalAnchor) return globalAnchor;

  return "自然室内或户外场景，与产品品类匹配，光线真实";
}

/** 将场景约束并入生图 prompt（避免重复拼接） */
export function mergeSceneIntoImagePrompt(
  basePrompt: string,
  sceneText: string,
): string {
  const base = basePrompt.trim();
  const scene = sceneText.trim();
  if (!scene) return base;
  if (base.includes(scene) || base.includes(SCENE_REF_PRIMARY)) return base;
  if (/场景[：:]/u.test(base) && scene.length < 40) return base;
  return `场景：${scene}。${base}`;
}

/** 前端预览：拼接场景 / 生图 / 生视频三段 */
export function formatPanelPromptPreview(opts: {
  panel: PanelSceneFields & {
    action?: string;
    imagePrompt?: string;
    videoPromptEn?: string;
  };
  references?: StoryboardReference[];
  sceneCtx?: PanelScenePromptContext;
}): string {
  const refs = opts.references ?? [];
  const sceneRefs = getStoryboardSceneRefs(refs);
  const sceneText = resolvePanelSceneText(opts.panel, refs, opts.sceneCtx);
  const lines: string[] = [];
  if (sceneRefs.length > 0) {
    lines.push(`【场景参考】已上传 ${sceneRefs.length} 张场景图`);
  }
  lines.push(`【场景 Prompt】\n${sceneText}`);
  if (opts.panel.imagePrompt?.trim()) {
    lines.push(`【生图 Prompt】\n${opts.panel.imagePrompt.trim()}`);
  } else {
    const fallback = [opts.panel.scene?.trim(), opts.panel.action?.trim()]
      .filter(Boolean)
      .join(" · ");
    lines.push(`【生图 Prompt】\n${fallback || "（暂无 imagePrompt）"}`);
  }
  if (opts.panel.videoPromptEn?.trim()) {
    lines.push(`【生视频 Prompt】\n${opts.panel.videoPromptEn.trim()}`);
  } else {
    lines.push("【生视频 Prompt】\n（暂无 videoPrompt，成片时将使用场景+动作模板）");
  }
  return lines.join("\n\n");
}
