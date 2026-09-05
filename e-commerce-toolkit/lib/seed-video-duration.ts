/** 与 book-mall/lib/ecom/ecom-seed-video-duration.ts 逻辑一致 */

export const SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC = 20;

const DURATION_MIN_SEC = 3;
const DURATION_MAX_SEC = 120;

const CHOICE_PREFIXES = [
  /^全部生成/,
  /^我选择成片风格/,
  /^选成片风格/,
  /^重新生成/,
  /^修改分镜时长/,
  /^替换 BGM/,
  /^确认分镜执行表/,
  /^确认逐镜参数表/,
  /^确认成片参数/,
  /^我选择方案/,
  /^(?:选|我要)方案\s*[ABCabc]/,
  /^选[①②③123]$/,
  /^【?[123]】?$/,
  /^方案[①②③123ABCabc]$/,
  /^[AaBbCc]$/,
];

function isPlanningChoiceMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CHOICE_PREFIXES.some((re) => re.test(t));
}

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
    if (!content || isPlanningChoiceMessage(content)) continue;
    out.push(content);
  }
  return out;
}

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
  return SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC;
}
