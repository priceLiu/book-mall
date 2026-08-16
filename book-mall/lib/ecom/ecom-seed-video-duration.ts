import {
  ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC,
} from "@/lib/ecom/ecom-seed-video-types";
import { isSeedVideoChoiceMessage } from "@/lib/ecom/ecom-seed-video-workflow";

export { ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC };

const DURATION_MIN_SEC = 3;
const DURATION_MAX_SEC = 120;

/** 从用户策划 Prompt 解析目标成片秒数；未说明则 null */
export function parseSeedVideoTargetDurationFromText(text: string): number | null {
  const t = text.trim();
  if (!t) return null;

  const patterns = [
    /(?:视频)?(?:时长|总时长|预计|约|大概|目标)[^\d]{0,10}(\d{1,3})\s*(?:s|秒)/gi,
    /(\d{1,3})\s*(?:s|秒)\s*(?:成片|视频|短视频|种草)?/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(t);
    if (!m?.[1]) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= DURATION_MIN_SEC && n <= DURATION_MAX_SEC) return n;
  }
  return null;
}

export function collectSeedVideoPlanningTexts(opts: {
  turns?: Array<{ role: string; content: string }>;
  planningPrompt?: string;
}): string[] {
  const out: string[] = [];
  const planning = opts.planningPrompt?.trim();
  if (planning) out.push(planning);
  for (const m of opts.turns ?? []) {
    if (m.role !== "user") continue;
    const content = m.content.trim();
    if (!content || isSeedVideoChoiceMessage(content)) continue;
    out.push(content);
  }
  return out;
}

/** 目标成片时长：优先用户 Prompt，其次已定稿方案，再次 settings；均未指定则 20s */
export function resolveSeedVideoTargetDurationSec(opts: {
  texts?: string[];
  planDurationSec?: number;
  settingsTargetDurationSec?: number;
}): number {
  for (const text of opts.texts ?? []) {
    const parsed = parseSeedVideoTargetDurationFromText(text);
    if (parsed != null) return parsed;
  }
  if (opts.planDurationSec != null && opts.planDurationSec > 0) {
    return Math.round(opts.planDurationSec);
  }
  if (opts.settingsTargetDurationSec != null && opts.settingsTargetDurationSec > 0) {
    return Math.round(opts.settingsTargetDurationSec);
  }
  return ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC;
}
