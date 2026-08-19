/**
 * Pro2 制作包 · JSON → GFM Markdown 渲染（Hub Tab / revision 展示兼容）
 */
import {
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_HANDOFF_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "./data/pro2-production-pack-standard";
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function formatPalette(
  label: string,
  palette?: { primary?: string; highlight?: string; shadow?: string },
): string {
  if (!palette) return "—";
  const parts = [palette.primary, palette.highlight, palette.shadow]
    .filter(Boolean)
    .join(" / ");
  return parts.trim() || "—";
}

export function renderVisualStyleSection(
  script: Pro2ProductionScript,
): string {
  const vs = script.visualStyle;
  if (!vs) return "";
  const rows: Array<[string, string]> = [
    ["故事背景", vs.worldBackground ?? "—"],
    ["年代/环境定位", vs.era ?? "—"],
    ["全剧色调基调", vs.globalColorTone ?? "—"],
    ["画面风格", vs.pictureStyle ?? "—"],
    ["摄影风格", vs.cinematography ?? "—"],
    ["日景调色板", formatPalette("日景", vs.dayPalette)],
    ["夜景调色板", formatPalette("夜景", vs.nightPalette)],
    ["皮肤/材质基调", vs.skinMaterial ?? "—"],
    ["建筑风格/置景", vs.setDesign ?? "—"],
    ["光影基调", vs.lighting ?? "—"],
    ["英文风格锚定", vs.styleAnchor ?? "—"],
  ];
  const lines = [
    "## 视觉风格总纲",
    "",
    "| 维度 | 内容 |",
    "|------|------|",
    ...rows.map(([dim, val]) => `| ${dim} | ${escCell(val)} |`),
  ];
  return lines.join("\n");
}

export function renderCoreConflictSection(
  script: Pro2ProductionScript,
): string {
  const items = script.coreConflict ?? [];
  if (!items.length) return "";
  const lines = [
    "## 核心冲突与结构摘要",
    "",
    "| 维度 | 内容 |",
    "|------|------|",
    ...items.map(
      (r) => `| ${escCell(r.dimension)} | ${escCell(r.content)} |`,
    ),
  ];
  return lines.join("\n");
}

export function renderScenesSection(script: Pro2ProductionScript): string {
  const scenes = script.scenes ?? [];
  if (!scenes.length) return "";
  const lines = [
    "## 场景视觉辞典",
    "",
    STORY_PRO2_SCENE_TABLE_HEADER,
    ...scenes.map(
      (s) =>
        `| ${escCell(s.name)} | ${escCell(s.environmentTimeMood)} | ${escCell(s.imagePrompt)} | ${escCell(s.negativePrompt || "—")} |`,
    ),
  ];
  return lines.join("\n");
}

export function renderCharactersSection(script: Pro2ProductionScript): string {
  const chars = script.characters ?? [];
  if (!chars.length) return "";
  const lines = [
    "## 角色视觉辞典",
    "",
    STORY_PRO2_CHARACTER_TABLE_HEADER,
    ...chars.map(
      (c) =>
        `| ${escCell(c.name)} | ${escCell(c.role)} | ${escCell(c.appearance)} | ${escCell(c.personality || "—")} | ${escCell(c.imagePrompt)} |`,
    ),
  ];
  return lines.join("\n");
}

export function renderStoryboardSection(script: Pro2ProductionScript): string {
  const shots = script.shots ?? [];
  if (!shots.length) return "";
  const lines = [
    "## 分镜脚本",
    "",
    STORY_PRO2_STORYBOARD_TABLE_HEADER,
    ...shots.map(
      (s) =>
        `| ${s.index} | ${escCell(s.shotSize ?? "—")} | ${escCell(s.cameraMove ?? "—")} | ${escCell(s.sceneDescription)} | ${escCell(s.dialogue || "—")} | ${s.durationSec ?? "—"} | ${escCell(s.imagePrompt ?? "—")} | ${escCell(s.videoPrompt ?? "—")} | ${escCell(s.audioNote || "—")} |`,
    ),
  ];
  return lines.join("\n");
}

export function renderHandoffSection(script: Pro2ProductionScript): string {
  const items = script.handoff ?? [];
  if (!items.length) return "";
  const lines = [
    "## 下一步交接清单",
    "",
    STORY_PRO2_HANDOFF_TABLE_HEADER,
    ...items.map(
      (h) =>
        `| ${h.index} | ${escCell(h.item)} | ${escCell(h.owner)} | ${escCell(h.note || "—")} |`,
    ),
  ];
  return lines.join("\n");
}

/** outlineMd：视觉风格 + 核心冲突 + 场景辞典 + 交接清单 */
export function renderProductionScriptOutlineMd(
  script: Pro2ProductionScript,
): string {
  return [
    renderVisualStyleSection(script),
    renderCoreConflictSection(script),
    renderScenesSection(script),
    renderHandoffSection(script),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderProductionScriptCharacterMd(
  script: Pro2ProductionScript,
): string {
  return renderCharactersSection(script);
}

export function renderProductionScriptSceneMd(
  script: Pro2ProductionScript,
): string {
  return renderScenesSection(script);
}

export function renderProductionScriptStoryboardMd(
  script: Pro2ProductionScript,
): string {
  return renderStoryboardSection(script);
}

/** 完整六章 GFM（人读 + legacy 兼容） */
export function renderProductionScriptMarkdown(
  script: Pro2ProductionScript,
): string {
  return [
    renderVisualStyleSection(script),
    renderCoreConflictSection(script),
    renderScenesSection(script),
    renderCharactersSection(script),
    renderStoryboardSection(script),
    renderHandoffSection(script),
  ]
    .filter(Boolean)
    .join("\n\n");
}
