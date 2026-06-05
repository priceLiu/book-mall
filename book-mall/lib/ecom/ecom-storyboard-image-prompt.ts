import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

/** 分镜静帧禁止渲染口播/对白为画面文字 */
export const STORYBOARD_NO_DIALOGUE_IN_IMAGE =
  "严禁在画面中出现任何对白字幕、台词文字、气泡对话框、口播文案叠字或横幅标语；口播内容仅作表演指导，不得渲染为可见文字";

export function buildStoryboardCompositeImagePrompt(
  sheet: StoryboardSheet,
  refs: StoryboardReference[],
  aspectRatio: "16:9" | "9:16",
): string {
  const panelLines = sheet.panels
    .map(
      (p) =>
        `Panel ${p.index} (${p.timeline ?? ""}): ${p.shotType}, camera ${p.camera ?? "fixed"}, scene: ${p.scene}, action: ${p.action}, mood: ${p.emotion ?? "natural"}`,
    )
    .join("; ");

  const productRef = refs.find((r) => r.role === "product");
  const charRef = refs.find((r) => r.role === "character");

  const refHint = [
    productRef ? "include product reference styling from uploaded product image" : "",
    charRef ? "match character appearance from uploaded character reference" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Professional e-commerce video storyboard sheet, ${aspectRatio} vertical layout,`,
    `${sheet.panels.length} sequential storyboard panels in a clean grid with borders and shot labels,`,
    `Chinese kitchen cleaning product UGC micro-drama style, photorealistic,`,
    `title: ${sheet.overview.title}, logline: ${sheet.overview.logline},`,
    panelLines,
    refHint,
    "high detail, consistent lighting, no watermark",
    STORYBOARD_NO_DIALOGUE_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(" ");
}

/** 与 wan2.7 多图 content 顺序一致：产品 → 角色 → 场景 */
export function buildStoryboardPanelRefGuide(refs: StoryboardReference[]): string {
  const products = refs.filter((r) => r.role === "product");
  const characters = refs.filter((r) => r.role === "character");
  const scenes = refs.filter((r) => r.role === "scene" || r.role === "other");

  let idx = 1;
  const parts: string[] = [];
  if (products.length) {
    parts.push(`图${idx}为产品包装参考，画面中须自然露出该产品`);
    idx += products.length;
  }
  for (let i = 0; i < characters.length; i++) {
    parts.push(
      `图${idx + i}为角色参考${characters.length > 1 ? i + 1 : ""}，人物面部、发型、体型与服装须与参考图一致`,
    );
  }
  idx += characters.length;
  for (let i = 0; i < scenes.length; i++) {
    parts.push(`图${idx + i}为场景参考，厨房光线、环境与道具风格须与参考一致`);
  }
  return parts.join("；");
}

export function buildStoryboardPanelImagePrompt(
  panel: StoryboardSheet["panels"][0],
  sheet: StoryboardSheet,
  refs: StoryboardReference[],
): string {
  const voiceoverHint = panel.dialogue?.trim()
    ? `表演情绪参考（勿渲染为画面文字）：${panel.dialogue.trim()}`
    : "";

  return [
    "Single photorealistic storyboard frame for Chinese e-commerce UGC micro-drama,",
    `shot ${panel.index}, ${panel.shotType}, camera ${panel.camera ?? "static"},`,
    `scene: ${panel.scene}, action: ${panel.action},`,
    `emotion: ${panel.emotion ?? "natural"},`,
    voiceoverHint,
    `product: ${sheet.overview.productHighlight ?? sheet.overview.title},`,
    "vertical 9:16 frame, bright home kitchen lighting, clean composition,",
    "no watermark, no panel borders",
    STORYBOARD_NO_DIALOGUE_IN_IMAGE,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildCharacterRefPrompt(sheet: StoryboardSheet): string {
  const castHint =
    sheet.cast.length > 0
      ? sheet.cast.map((c) => `${c.name} (${c.role})`).join(", ")
      : "friendly Chinese homemaker, natural UGC style";
  return [
    "Portrait reference photo for short video character,",
    castHint,
    "kitchen cleaning product ad, natural indoor lighting,",
    "9:16 portrait, photorealistic, neutral background, friendly expression",
  ].join(" ");
}
