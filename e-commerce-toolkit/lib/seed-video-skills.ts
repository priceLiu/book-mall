/** 与 book-mall/lib/ecom/ecom-seed-video-skills.ts 保持同步 */

export const SEED_VIDEO_SKILL_KEYS = [
  "seed-grass",
  "fashion-hit",
  "digital-product",
  "home-clothes-lounge-wear",
] as const;
export type SeedVideoSkillKey = (typeof SEED_VIDEO_SKILL_KEYS)[number];

export type SeedVideoSkillDefinition = {
  key: SeedVideoSkillKey;
  label: string;
  description: string;
  defaultTitle: string;
  defaultPlanningPrompt: string;
  scriptChoiceLabels: [string, string, string];
};

export const SEED_VIDEO_SKILLS: Record<SeedVideoSkillKey, SeedVideoSkillDefinition> = {
  "seed-grass": {
    key: "seed-grass",
    label: "种草短视频",
    description: "生活方式种草、度假氛围、不费力高级感",
    defaultTitle: "图片生种草视频",
    defaultPlanningPrompt:
      "@图片1 @图片2 帮我用这些素材生成 3 套种草短视频脚本（带口播），时长约 20 秒，给我选择确认。",
    scriptChoiceLabels: [
      "脚本一：氛围感切入‑不费力的高级",
      "脚本二：痛点切入‑梨形身材天菜",
      "脚本三：场景切入‑度假出片指南",
    ],
  },
  "fashion-hit": {
    key: "fashion-hit",
    label: "服装爆款带货",
    description: "服装带货钩子、痛点转化、多场景实穿",
    defaultTitle: "服装爆款带货视频",
    defaultPlanningPrompt:
      "@图片1 @图片2 @图片3 帮我用这些服装素材生成 3 套爆款带货视频脚本（带口播），时长约 20 秒，给我选择确认。",
    scriptChoiceLabels: [
      "脚本一：氛围感爆款",
      "脚本二：痛点爆款",
      "脚本三：场景爆款",
    ],
  },
  "digital-product": {
    key: "digital-product",
    label: "3C 数码带货",
    description: "外观种草、痛点转化、场景实用测评",
    defaultTitle: "3C 数码带货视频",
    defaultPlanningPrompt:
      "@图片1 @图片2 帮我用这些 3C 产品素材生成 3 套爆款带货视频脚本（带口播），时长约 20 秒，给我选择确认。",
    scriptChoiceLabels: [
      "脚本一：视觉体验向",
      "脚本二：痛点解决向",
      "脚本三：场景实用向",
    ],
  },
  "home-clothes-lounge-wear": {
    key: "home-clothes-lounge-wear",
    label: "家居服带货",
    description: "软糯质感种草、居家舒适痛点、居家场景穿搭",
    defaultTitle: "家居服带货视频",
    defaultPlanningPrompt:
      "@图片1 @图片2 帮我用这些家居服素材生成 3 套带货短视频脚本（带口播），时长约 20 秒，给我选择确认。",
    scriptChoiceLabels: [
      "脚本一：质感治愈向",
      "脚本二：痛点舒适向",
      "脚本三：居家场景向",
    ],
  },
};

export function isSeedVideoSkillKey(raw: unknown): raw is SeedVideoSkillKey {
  return typeof raw === "string" && (SEED_VIDEO_SKILL_KEYS as readonly string[]).includes(raw);
}

export function resolveSeedVideoSkillKey(raw: unknown): SeedVideoSkillKey {
  return isSeedVideoSkillKey(raw) ? raw : "seed-grass";
}

export function getSeedVideoSkillDefinition(key: SeedVideoSkillKey): SeedVideoSkillDefinition {
  return SEED_VIDEO_SKILLS[key];
}

export function listSeedVideoSkillDefinitions(): SeedVideoSkillDefinition[] {
  return SEED_VIDEO_SKILL_KEYS.map((k) => SEED_VIDEO_SKILLS[k]);
}

export function seedVideoSkillLabel(raw: unknown): string {
  return getSeedVideoSkillDefinition(resolveSeedVideoSkillKey(raw)).label;
}
