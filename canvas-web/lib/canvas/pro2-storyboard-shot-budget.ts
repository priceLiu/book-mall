import { parseStoryboardRows } from "./parse-md-tables";

const PER_SHOT_SEC_MIN = 10;
const PER_SHOT_SEC_MAX = 15;
const DEFAULT_TARGET_DURATION_SEC = 180;
const ABS_MIN_SHOTS = 12;
const ABS_MAX_SHOTS = 18;

function parseChineseDurationToSeconds(text: string): number | null {
  const t = text.trim();
  if (!t) return null;

  const minSec = t.match(/(\d+)\s*分(?:钟)?\s*(\d+)\s*秒/);
  if (minSec) {
    return parseInt(minSec[1]!, 10) * 60 + parseInt(minSec[2]!, 10);
  }

  const rangeMin = t.match(/(\d+)\s*[-~～至到]\s*(\d+)\s*分(?:钟)?/);
  if (rangeMin) {
    return parseInt(rangeMin[1]!, 10) * 60;
  }

  const minutes = t.match(/(\d+)\s*分(?:钟)?/);
  if (minutes) return parseInt(minutes[1]!, 10) * 60;

  const seconds = t.match(/(\d+)\s*秒/);
  if (seconds) return parseInt(seconds[1]!, 10);

  const minEn = t.match(/(\d+)\s*min/i);
  if (minEn) return parseInt(minEn[1]!, 10) * 60;

  return null;
}

/** 从故事大纲解析目标总时长（秒）；解析失败返回 null */
export function extractTargetDurationSecondsFromOutline(
  outlineMd: string,
): number | null {
  const md = outlineMd.trim();
  if (!md) return null;

  const tableRow = md.match(/预计时长\s*\|\s*([^|\n]+)/i);
  if (tableRow?.[1]) {
    const parsed = parseChineseDurationToSeconds(tableRow[1]);
    if (parsed) return parsed;
  }

  const labeled = md.match(
    /(?:单集|目标|预计|标准).{0,10}时长[^:\n：]*[：:]\s*([^\n|]+)/i,
  );
  if (labeled?.[1]) {
    const parsed = parseChineseDurationToSeconds(labeled[1]);
    if (parsed) return parsed;
  }

  const wholeDoc = parseChineseDurationToSeconds(md);
  if (wholeDoc) return wholeDoc;

  const anyMin = md.match(/(\d+)\s*分(?:钟)?/);
  if (anyMin) return parseInt(anyMin[1]!, 10) * 60;

  const anySec = md.match(/(\d+)\s*秒/);
  if (anySec) return parseInt(anySec[1]!, 10);

  return null;
}

export type Pro2StoryboardShotBudget = {
  targetDurationSec: number;
  minShots: number;
  maxShots: number;
  perShotSecMin: number;
  perShotSecMax: number;
};

export function resolvePro2StoryboardShotBudget(
  outlineMd: string,
): Pro2StoryboardShotBudget {
  const targetDurationSec =
    extractTargetDurationSecondsFromOutline(outlineMd) ??
    DEFAULT_TARGET_DURATION_SEC;
  const minShots = Math.max(
    ABS_MIN_SHOTS,
    Math.ceil(targetDurationSec / PER_SHOT_SEC_MAX),
  );
  const maxShots = Math.min(
    ABS_MAX_SHOTS,
    Math.max(minShots, Math.floor(targetDurationSec / PER_SHOT_SEC_MIN)),
  );
  return {
    targetDurationSec,
    minShots,
    maxShots,
    perShotSecMin: PER_SHOT_SEC_MIN,
    perShotSecMax: PER_SHOT_SEC_MAX,
  };
}

function formatDurationLabel(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0 && sec > 0) return `${min} 分 ${sec} 秒`;
  if (min > 0) return `${min} 分钟`;
  return `${sec} 秒`;
}

/** 分镜段 system / user prompt 追加块 */
export function buildPro2StoryboardShotBudgetPromptBlock(
  outlineMd: string,
): string {
  const b = resolvePro2StoryboardShotBudget(outlineMd);
  const durLabel = formatDurationLabel(b.targetDurationSec);
  const sumMin = b.targetDurationSec - 5;
  const sumMax = b.targetDurationSec + 5;
  return `# 镜数与时长预算（硬性 · 未达标视为失败）

- **目标总时长**：${durLabel}（${b.targetDurationSec} 秒；自故事大纲解析，若无则默认 ${DEFAULT_TARGET_DURATION_SEC} 秒）
- **每镜时长**：${b.perShotSecMin}–${b.perShotSecMax} 秒整数；各镜 \`时长(秒)\` **之和**须在 ${sumMin}–${sumMax} 秒
- **须输出镜数**：**${b.minShots}–${b.maxShots} 镜**（不得少于 **${b.minShots}** 镜；禁止只输出 1–2 镜样例即停）
- **禁止**用「镜数规划」小表或散文概括代替完整 10 列 GFM 分镜表`;
}

export function storyboardMeetsMinimumShotCount(
  storyboardMd: string,
  outlineMd: string,
): boolean {
  const rows = parseStoryboardRows(storyboardMd);
  if (!rows.length) return false;
  const { minShots } = resolvePro2StoryboardShotBudget(outlineMd);
  return rows.length >= minShots;
}
