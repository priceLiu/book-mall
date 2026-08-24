/** 剧本制作向导 · 统一表单控件样式（淡线 / 无强边框） */
export const PRO2_WIZARD_INPUT_CLASS =
  "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-white/90 outline-none transition placeholder:text-white/25 focus:border-white/10 focus:bg-white/[0.05]";

export const PRO2_WIZARD_TEXTAREA_CLASS = `${PRO2_WIZARD_INPUT_CLASS} resize-y`;

export const PRO2_WIZARD_MENTIONS_CLASS =
  "min-h-[100px] rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/90 outline-none transition focus:border-white/10 focus:bg-white/[0.05]";

/** 分镜图 / 视频 prompt · 更高 + @ 引用 */
export const PRO2_WIZARD_PROMPT_MENTIONS_CLASS =
  "min-h-[140px] rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/90 outline-none transition focus:border-white/10 focus:bg-white/[0.05]";

export const PRO2_WIZARD_DROPZONE_CLASS =
  "border-white/[0.08] bg-white/[0.02]";

/** 分镜表 · 仅叙事字段做资产引用高亮（画面描述 / 光影 / 运镜 / 对白） */
export const PRO2_WIZARD_NARRATIVE_SHOT_FIELDS = [
  "sceneDescription",
  "lighting",
  "cameraMove",
  "dialogue",
] as const;

export type Pro2WizardNarrativeShotField =
  (typeof PRO2_WIZARD_NARRATIVE_SHOT_FIELDS)[number];
