import type { StoryboardPanel, StoryboardReference } from "@/lib/storyboard-types";

const SCENE_REF_PRIMARY =
  "背景、光线、空间布局与道具须与用户上传的场景参考图一致";

function sceneRefs(refs: StoryboardReference[]): StoryboardReference[] {
  return refs.filter(
    (r) => (r.role === "scene" || r.role === "other") && r.ossUrl?.trim().startsWith("http"),
  );
}

function isPlaceholderScene(text?: string): boolean {
  const s = text?.trim();
  return !s || s === "—" || s === "场景";
}

/** 前端预览：解析与后端一致的场景 prompt 文本 */
export function resolvePanelSceneTextPreview(
  panel: Pick<StoryboardPanel, "scene" | "scenePrompt">,
  references: StoryboardReference[] = [],
  globalSceneAnchor?: string,
): string {
  const uploaded = sceneRefs(references);
  const panelScenePrompt = panel.scenePrompt?.trim();
  const panelScene = panel.scene?.trim();

  if (uploaded.length > 0) {
    const local =
      panelScenePrompt ||
      (!isPlaceholderScene(panelScene) ? panelScene : undefined);
    if (local) {
      return `${SCENE_REF_PRIMARY}；本镜机位与局部变化：${local}`;
    }
    return SCENE_REF_PRIMARY;
  }

  if (panelScenePrompt) return panelScenePrompt;
  if (!isPlaceholderScene(panelScene)) {
    const anchor = globalSceneAnchor?.trim();
    if (anchor && !panelScene!.includes(anchor)) {
      return `${anchor}，${panelScene}`;
    }
    return panelScene!;
  }
  return globalSceneAnchor?.trim() || "（暂无场景 prompt）";
}

/** 前端 Prompt 预览弹层：场景 / 生图 / 生视频 三段 */
export function formatPanelPromptPreview(opts: {
  panel: StoryboardPanel;
  references?: StoryboardReference[];
  globalSceneAnchor?: string;
}): string {
  const refs = opts.references ?? [];
  const uploaded = sceneRefs(refs);
  const sceneText = resolvePanelSceneTextPreview(
    opts.panel,
    refs,
    opts.globalSceneAnchor,
  );
  const lines: string[] = [];
  if (uploaded.length > 0) {
    lines.push(`【场景参考】已上传 ${uploaded.length} 张场景图`);
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
