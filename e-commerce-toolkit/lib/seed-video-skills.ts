/** 与 book-mall/lib/ecom/ecom-seed-video-skills.ts 保持同步 */

import type { SeedVideoStylePreset } from "@/lib/seed-video-types";

export const SEED_VIDEO_SKILL_KEYS = [
  "seed-grass",
  "fashion-hit",
  "digital-product",
  "home-clothes-lounge-wear",
] as const;
export type SeedVideoSkillKey = (typeof SEED_VIDEO_SKILL_KEYS)[number];

export type SeedVideoStyleChoicePreset = {
  presetId: SeedVideoStylePreset;
  label: string;
  title: string;
  description: string;
  voiceLabel?: string;
  bgmLabel?: string;
  copyTone?: string;
};

export type SeedVideoSkillDefinition = {
  key: SeedVideoSkillKey;
  label: string;
  description: string;
  defaultTitle: string;
  defaultPlanningPrompt: string;
  scriptChoiceLabels: [string, string, string];
  styleChoicePresets: [SeedVideoStyleChoicePreset, SeedVideoStyleChoicePreset];
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
    styleChoicePresets: [
      {
        presetId: "sweet-xhs",
        label: "A方案：甜美种草风（小红书）",
        title: "A方案：甜美种草风（小红书）",
        description: "湾湾小何音色，轻快甜美 BGM，姐妹分享感",
        voiceLabel: "湾湾小何",
        bgmLabel: "轻快甜美轻音乐",
        copyTone: "姐妹分享感",
      },
      {
        presetId: "sharp-douyin",
        label: "B方案：干练安利风（抖音带货）",
        title: "B方案：干练安利风（抖音带货）",
        description: "爽快思思音色，节奏感卡点 BGM，短促有力",
        voiceLabel: "爽快思思",
        bgmLabel: "节奏感卡点 BGM",
        copyTone: "短促有力带货",
      },
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
    styleChoicePresets: [
      {
        presetId: "sweet-xhs",
        label: "A方案：甜美种草带货风（小红书）",
        title: "A方案：甜美种草带货风（小红书）",
        description: "湾湾小何音色，轻快甜美 BGM，姐妹分享式软种草",
        voiceLabel: "湾湾小何",
        bgmLabel: "轻快甜美 BGM",
        copyTone: "姐妹分享式软种草",
      },
      {
        presetId: "sharp-douyin",
        label: "B方案：强转化干练带货风（抖音）",
        title: "B方案：强转化干练带货风（抖音）",
        description: "爽快思思音色，卡点 BGM，短句强钩子强转化",
        voiceLabel: "爽快思思",
        bgmLabel: "卡点 BGM",
        copyTone: "短句强钩子强转化",
      },
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
    styleChoicePresets: [
      {
        presetId: "sweet-xhs",
        label: "A方案：数码分享种草风（小红书测评）",
        title: "A方案：数码分享种草风（小红书测评）",
        description: "松弛真实测评感，温和解说，轻快 BGM",
        voiceLabel: "温和解说",
        bgmLabel: "轻快 BGM",
        copyTone: "松弛真实测评感",
      },
      {
        presetId: "sharp-douyin",
        label: "B方案：强转化带货风（抖音）",
        title: "B方案：强转化带货风（抖音）",
        description: "快节奏、重转化，爽快音色，卡点 BGM",
        voiceLabel: "爽快利落",
        bgmLabel: "卡点 BGM",
        copyTone: "快节奏强转化",
      },
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
    styleChoicePresets: [
      {
        presetId: "sweet-xhs",
        label: "A方案：温柔治愈风（小红书）",
        title: "A方案：温柔治愈风（小红书）",
        description: "温柔软糯、治愈松弛，轻柔舒缓居家 BGM",
        voiceLabel: "温柔软糯",
        bgmLabel: "轻柔舒缓居家 BGM",
        copyTone: "治愈种草、居家氛围感",
      },
      {
        presetId: "sharp-douyin",
        label: "B方案：居家带货风（抖音）",
        title: "B方案：居家带货风（抖音）",
        description: "亲切自然、接地气，共鸣痛点、突出舒适实用",
        voiceLabel: "亲切自然",
        bgmLabel: "轻柔舒缓小众卡点 BGM",
        copyTone: "共鸣痛点、高转化居家带货",
      },
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

export function formatSeedVideoSelectedScriptLabel(
  scriptId: string | undefined,
  skillKey: SeedVideoSkillKey,
): string {
  const labels = getSeedVideoSkillDefinition(skillKey).scriptChoiceLabels;
  if (scriptId === "script-1") return labels[0];
  if (scriptId === "script-2") return labels[1];
  if (scriptId === "script-3") return labels[2];
  return "已选脚本";
}

export function allSeedVideoStyleChoiceLabels(): string[] {
  return listSeedVideoSkillDefinitions().flatMap((s) =>
    s.styleChoicePresets.map((p) => p.label),
  );
}

export function buildSeedVideoStyleAssistantChoices(
  skillKey: SeedVideoSkillKey,
): Array<{
  id: string;
  label: string;
  title: string;
  description: string;
  message: string;
  kind: "style";
}> {
  return getSeedVideoSkillDefinition(skillKey).styleChoicePresets.map((preset, index) => ({
    id: `style-${index + 1}`,
    label: preset.label,
    title: preset.title,
    description: preset.description,
    kind: "style" as const,
    message: preset.label,
  }));
}
