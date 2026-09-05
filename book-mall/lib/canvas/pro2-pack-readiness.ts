import { parseHandoffRows, parseStoryboardRows } from "./parse-md-tables";
import { storyboardMeetsMinimumShotCount } from "./pro2-storyboard-shot-budget";

const EMPTY_CELL = /^[-—–\s]*$/;

function isEmptyPackCell(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  return EMPTY_CELL.test(t);
}

function normHeaderLine(md: string): string {
  const header = md
    .split(/\r?\n/)
    .find(
      (l) =>
        l.trim().startsWith("|") &&
        l.trim().endsWith("|") &&
        !/^[\|\s\-:]+$/.test(l.trim()),
    );
  return (header ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isV2StoryboardMd(storyboardMd: string): boolean {
  const nk = normHeaderLine(storyboardMd);
  return nk.includes("光影") && !nk.includes("ai生图");
}

/** 分镜表每镜允许空白的列（无对白场景） */
function isOptionalStoryboardCell(
  key: string,
  value: string | undefined,
): boolean {
  if ((key === "dialogue" || key === "propNames") && isEmptyPackCell(value)) {
    return true;
  }
  if (key === "scene" && isEmptyPackCell(value)) return true;
  return false;
}

const REQUIRED_STORYBOARD_FIELDS_V1 = [
  "shotSize",
  "cameraMove",
  "description",
  "duration",
  "aiImagePrompt",
  "aiVideoPrompt",
  "lipSyncNote",
] as const;

const REQUIRED_STORYBOARD_FIELDS_V2 = [
  "shotSize",
  "lighting",
  "cameraMove",
  "description",
  "duration",
  "sfxNote",
  "lipSyncNote",
] as const;

/** 镜数 + 分镜表完整性（v2 十列 / v1 九列 · 对白/道具可为 —） */
export function storyboardMeetsPackQuality(
  storyboardMd: string,
  outlineMd: string,
): boolean {
  if (!storyboardMeetsMinimumShotCount(storyboardMd, outlineMd)) {
    return false;
  }
  const rows = parseStoryboardRows(storyboardMd);
  if (!rows.length) return false;
  const required = isV2StoryboardMd(storyboardMd)
    ? REQUIRED_STORYBOARD_FIELDS_V2
    : REQUIRED_STORYBOARD_FIELDS_V1;
  for (const row of rows) {
    for (const key of required) {
      const val = String(row[key as keyof typeof row] ?? "");
      if (isOptionalStoryboardCell(key, val)) continue;
      if (isEmptyPackCell(val)) return false;
    }
    if (isEmptyPackCell(row.dialogue) && isEmptyPackCell(row.description)) {
      return false;
    }
  }
  return true;
}

/** 大纲内交接清单 ≥6 行 */
export function handoffSectionPresent(outlineMd: string, minRows = 6): boolean {
  return parseHandoffRows(outlineMd).length >= minRows;
}

export function outlineMeetsPackHandoffQuality(
  outlineMd: string,
  minRows = 6,
): boolean {
  return handoffSectionPresent(outlineMd, minRows);
}
