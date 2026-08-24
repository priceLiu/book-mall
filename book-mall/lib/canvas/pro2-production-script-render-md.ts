/**
 * Pro2 制作包 · JSON → GFM Markdown 渲染（Hub Tab / revision 展示兼容）
 */
import {
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_HANDOFF_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER_V1,
} from "./data/pro2-production-pack-standard";
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";
import {
  ensurePro2ProductionScriptSchemaVersion,
  isPro2ProductionScriptV2,
} from "./data/pro2-production-script-schema";
import {
  resolvePro2PropIdToName,
  resolvePro2PropNamesCell,
  stripPro2AnchorPlaceholders,
} from "./pro2-chinese-prompt-normalize";
import { reconcileShotEntityLinks } from "./pro2-shot-entity-reconcile";
import {
  formatStoryboardTableMarkdown,
  parseStoryboardRows,
} from "./parse-md-tables";

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
        `| ${escCell(stripPro2AnchorPlaceholders(s.name))} | ${escCell(s.environmentTimeMood)} | ${escCell(s.imagePrompt)} | ${escCell(s.negativePrompt || "—")} |`,
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
        `| ${escCell(stripPro2AnchorPlaceholders(c.name))} | ${escCell(c.role)} | ${escCell(c.appearance)} | ${escCell(c.personality || "—")} | ${escCell(c.imagePrompt)} |`,
    ),
  ];
  return lines.join("\n");
}

export function renderPropsSection(script: Pro2ProductionScript): string {
  const props = script.props ?? [];
  if (!props.length) return "";
  const lines = [
    "## 道具视觉辞典",
    "",
    "| 道具名 | 描述 | 特征 | 道具生图提示词 |",
    "|------|------|------|----------------|",
    ...props.map(
      (p) =>
        `| ${escCell(p.name)} | ${escCell(p.description ?? "—")} | ${escCell(p.traits ?? "—")} | ${escCell(p.imagePrompt ?? "—")} |`,
    ),
  ];
  return lines.join("\n");
}

export function resolveShotPropNames(
  shot: NonNullable<Pro2ProductionScript["shots"]>[number],
  script: Pro2ProductionScript,
): string {
  const effective = reconcileShotEntityLinks(shot, script);
  const names =
    effective.propIds
      ?.map((id) => resolvePro2PropIdToName(String(id), script))
      .filter(Boolean) ?? [];
  return names.length ? names.join("、") : "—";
}

export function renderStoryboardSection(script: Pro2ProductionScript): string {
  const normalized = ensurePro2ProductionScriptSchemaVersion(script);
  const shots = normalized.shots ?? [];
  if (!shots.length) return "";
  const useV2 = isPro2ProductionScriptV2(normalized.schemaVersion);
  const header = useV2
    ? STORY_PRO2_STORYBOARD_TABLE_HEADER
    : STORY_PRO2_STORYBOARD_TABLE_HEADER_V1;
  const lines = [
    "## 分镜脚本",
    "",
    header,
    ...shots.map((s) => {
      if (useV2) {
        return `| ${s.index} | ${escCell(s.shotSize ?? "—")} | ${escCell(s.lighting ?? "—")} | ${escCell(s.cameraMove ?? "—")} | ${escCell(s.sceneDescription)} | ${escCell(resolveShotPropNames(s, normalized))} | ${escCell(s.dialogue || "—")} | ${s.durationSec ?? "—"} | ${escCell(s.sfxNote ?? "—")} | ${escCell(s.audioNote || "—")} |`;
      }
      return `| ${s.index} | ${escCell(s.shotSize ?? "—")} | ${escCell(s.cameraMove ?? "—")} | ${escCell(s.sceneDescription)} | ${escCell(s.dialogue || "—")} | ${s.durationSec ?? "—"} | ${escCell(s.imagePrompt ?? "—")} | ${escCell(s.videoPrompt ?? "—")} | ${escCell(s.audioNote || "—")} |`;
    }),
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

/** Hub 大纲 Tab 展示 · 聚合 meta + 各制作包章节（与 HtmlPreview outline 一致，不含分镜） */
export function renderHubOutlineDisplayMd(
  script: Pro2ProductionScript,
): string {
  const normalized = ensurePro2ProductionScriptSchemaVersion(script);
  const parts: string[] = [];
  if (normalized.meta?.title?.trim()) {
    parts.push(`# ${normalized.meta.title.trim()}`);
  }
  if (normalized.meta?.synopsis?.trim()) {
    parts.push(normalized.meta.synopsis.trim());
  }
  parts.push(
    renderVisualStyleSection(normalized),
    renderCoreConflictSection(normalized),
    renderCharactersSection(normalized),
    renderScenesSection(normalized),
    renderHandoffSection(normalized),
  );
  return parts.filter(Boolean).join("\n\n");
}

/** 分镜 MD · 从 JSON / 落库表合并人读 fallback 的道具、音效、口型列 */
export function enrichStoryboardMdShotFields(
  renderedMd: string,
  fallbackMd: string | undefined,
  script: Pro2ProductionScript,
): string {
  const normalized = ensurePro2ProductionScriptSchemaVersion(script);
  const renderedRows = parseStoryboardRows(renderedMd);
  if (!renderedRows.length) return renderedMd;
  const fallbackRows = parseStoryboardRows(fallbackMd ?? "");
  const byFrame = new Map(fallbackRows.map((r) => [r.frameIndex, r]));
  const shotsByIndex = new Map(
    (normalized.shots ?? []).map((s) => [s.index, s]),
  );
  const isEmptyCell = (value?: string) => {
    const t = value?.trim();
    return !t || t === "—";
  };
  let changed = false;
  const merged = renderedRows.map((row) => {
    let next = { ...row };
    const fb = byFrame.get(row.frameIndex);
    const shot = shotsByIndex.get(row.frameIndex);

    if (isEmptyCell(next.propNames)) {
      if (fb && !isEmptyCell(fb.propNames)) {
        next.propNames = resolvePro2PropNamesCell(fb.propNames, normalized);
        changed = true;
      } else if (shot?.propIds?.length) {
        next.propNames = resolveShotPropNames(shot, normalized);
        changed = true;
      }
    } else {
      const resolved = resolvePro2PropNamesCell(next.propNames, normalized);
      if (resolved !== next.propNames) {
        next.propNames = resolved;
        changed = true;
      }
    }

    if (isEmptyCell(next.sfxNote)) {
      if (fb && !isEmptyCell(fb.sfxNote)) {
        next.sfxNote = fb.sfxNote.trim();
        changed = true;
      } else if (shot?.sfxNote?.trim() && shot.sfxNote !== "—") {
        next.sfxNote = shot.sfxNote.trim();
        changed = true;
      }
    }

    if (isEmptyCell(next.lipSyncNote)) {
      if (fb && !isEmptyCell(fb.lipSyncNote)) {
        next.lipSyncNote = fb.lipSyncNote.trim();
        changed = true;
      } else if (shot?.audioNote?.trim() && shot.audioNote !== "—") {
        next.lipSyncNote = shot.audioNote.trim();
        changed = true;
      }
    }

    return next;
  });
  if (!changed) return renderedMd;
  const table = formatStoryboardTableMarkdown(merged);
  if (/##\s*分镜脚本/i.test(renderedMd)) {
    return renderedMd.replace(/##\s*分镜脚本[\s\S]*/i, `## 分镜脚本\n\n${table}`);
  }
  return `## 分镜脚本\n\n${table}`;
}

/** @deprecated 使用 enrichStoryboardMdShotFields */
export function enrichStoryboardMdPropNames(
  renderedMd: string,
  fallbackMd: string | undefined,
  script: Pro2ProductionScript,
): string {
  return enrichStoryboardMdShotFields(renderedMd, fallbackMd, script);
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

/** 预览/编辑 · 分镜表行合并 JSON shots 的道具/音效/口型（MD 列为空时） */
export function mergeStoryboardRowsWithProductionScript<
  T extends {
    frameIndex: number;
    propNames?: string;
    sfxNote?: string;
    lipSyncNote?: string;
  },
>(rows: T[], script?: Pro2ProductionScript | null): T[] {
  if (!rows.length || !script?.shots?.length) return rows;
  const normalized = ensurePro2ProductionScriptSchemaVersion(script);
  const byIndex = new Map(normalized.shots!.map((s) => [s.index, s]));
  const isEmptyCell = (value?: string) => {
    const t = value?.trim();
    return !t || t === "—";
  };
  return rows.map((row) => {
    const shot = byIndex.get(row.frameIndex);
    if (!shot) return row;
    let next = { ...row };
    if (isEmptyCell(next.propNames) && shot.propIds?.length) {
      next.propNames = resolveShotPropNames(shot, normalized);
    }
    if (isEmptyCell(next.sfxNote) && !isEmptyCell(shot.sfxNote)) {
      next.sfxNote = shot.sfxNote!.trim();
    }
    if (isEmptyCell(next.lipSyncNote) && !isEmptyCell(shot.audioNote)) {
      next.lipSyncNote = shot.audioNote!.trim();
    }
    return next;
  });
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
    renderPropsSection(script),
    renderStoryboardSection(script),
    renderHandoffSection(script),
  ]
    .filter(Boolean)
    .join("\n\n");
}
