import { parseHandoffRows, parseStoryboardRows } from "./parse-md-tables";
import { storyboardMeetsMinimumShotCount } from "./pro2-storyboard-shot-budget";

const EMPTY_CELL = /^[-—–\s]*$/;

function isEmptyPackCell(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  return EMPTY_CELL.test(t);
}

/** 分镜表每镜允许空白的列（无对白场景） */
function isOptionalStoryboardCell(
  key: keyof ReturnType<typeof parseStoryboardRows>[number],
  value: string | undefined,
): boolean {
  if (key === "dialogue" && isEmptyPackCell(value)) return true;
  if (key === "scene" && isEmptyPackCell(value)) return true;
  return false;
}

const REQUIRED_STORYBOARD_FIELDS = [
  "shotSize",
  "cameraMove",
  "description",
  "duration",
  "aiImagePrompt",
  "aiVideoPrompt",
  "lipSyncNote",
] as const;

/** 镜数 + 9 列完整性（对白可为 —） */
export function storyboardMeetsPackQuality(
  storyboardMd: string,
  outlineMd: string,
): boolean {
  if (!storyboardMeetsMinimumShotCount(storyboardMd, outlineMd)) {
    return false;
  }
  const rows = parseStoryboardRows(storyboardMd);
  if (!rows.length) return false;
  for (const row of rows) {
    for (const key of REQUIRED_STORYBOARD_FIELDS) {
      const val = String(row[key] ?? "");
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
