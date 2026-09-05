/** 烧录字幕单条 cue 文案上限（避免整段 prompt 铺满屏幕） */
export const BURN_IN_SUBTITLE_MAX_CHARS = 160;
/** 单条烧录 cue 推荐字数（竖屏口播；超过则按时长切句） */
export const BURN_IN_SUBTITLE_CUE_MAX_CHARS = 18;

/**
 * 将口播/对白整理为适合 SRT 烧录的单行文案：
 * - 去掉分镜表头（如「2 5s」「镜 3」）
 * - 多行时优先含冒号的对白行
 * - 避免 SRT 解析歧义（-->、空行）
 */
export function normalizeSubtitleBurnInText(raw: string | undefined | null): string {
  if (!raw?.trim()) return "";
  let t = raw.replace(/\r\n/g, "\n").trim();
  if (t === "—" || t === "-") return "";

  const lines = t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\d+\s+\d+\s*s?$/.test(l))
    .filter((l) => !/^镜\s*\d+/i.test(l));

  const pick =
    lines.find((l) => /[：:]/.test(l)) ??
    lines.find((l) => l.length <= BURN_IN_SUBTITLE_MAX_CHARS) ??
    lines[0] ??
    t.split("\n")[0]?.trim() ??
    "";

  return pick
    .replace(/-->/g, "→")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BURN_IN_SUBTITLE_MAX_CHARS);
}

/** 去掉说话人前缀，保留口播正文（「小红：你好」→「你好」） */
export function stripSubtitleSpeakerPrefix(text: string): string {
  const t = text.trim();
  const m = t.match(/^[^：:]{1,16}[：:]\s*(.+)$/);
  return (m?.[1] ?? t).trim();
}

/**
 * 将长文按标点/字数切成烧录短句（保留标点在句末）。
 * 先按强标点，再按逗号，最后按字数硬切，避免整段同时铺屏。
 */
export function splitSubtitleTextIntoBurnInParts(
  raw: string,
  maxChars = BURN_IN_SUBTITLE_CUE_MAX_CHARS,
): string[] {
  const normalized = raw
    .replace(/-->/g, "→")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const strongParts = normalized
    .split(/(?<=[。！？!?；;])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const withCommas: string[] = [];
  for (const part of strongParts.length > 0 ? strongParts : [normalized]) {
    if (part.length <= maxChars) {
      withCommas.push(part);
      continue;
    }
    const commaParts = part
      .split(/(?<=[，、,])/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (commaParts.length <= 1) {
      withCommas.push(part);
      continue;
    }
    let buf = "";
    for (const c of commaParts) {
      if (!buf) {
        buf = c;
        continue;
      }
      if (buf.length + c.length <= maxChars) {
        buf += c;
      } else {
        withCommas.push(buf);
        buf = c;
      }
    }
    if (buf) withCommas.push(buf);
  }

  const out: string[] = [];
  for (const part of withCommas) {
    if (part.length <= maxChars) {
      out.push(part);
      continue;
    }
    for (let i = 0; i < part.length; i += maxChars) {
      out.push(part.slice(i, i + maxChars));
    }
  }
  return out.length > 0 ? out : [normalized.slice(0, maxChars)];
}

export type SubtitleTimingOptions = {
  /** xfade 转场时长；>0 时各镜字幕起点与合成时间线对齐 */
  transitionSec?: number;
  transitionType?: "xfade" | "none";
};

export function formatSrtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const ms = Math.round((totalSec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** 按合成时间线计算每镜字幕起止（秒） */
export function computeSubtitleCueTimes(
  durationsSec: number[],
  opts?: SubtitleTimingOptions,
): Array<{ startSec: number; endSec: number }> {
  const transitionSec =
    opts?.transitionType === "xfade" && (opts.transitionSec ?? 0) > 0
      ? opts.transitionSec!
      : 0;
  const cues: Array<{ startSec: number; endSec: number }> = [];
  let cursor = 0;
  for (let i = 0; i < durationsSec.length; i++) {
    const dur = durationsSec[i]! > 0 ? durationsSec[i]! : 3;
    const startSec = cursor;
    const endSec = startSec + dur;
    cues.push({ startSec, endSec });
    cursor = endSec - (i < durationsSec.length - 1 ? transitionSec : 0);
  }
  return cues;
}

export type SubtitleTimedCue = {
  startSec: number;
  endSec: number;
  text: string;
};

/**
 * 将已有起止时间的长字幕按时长比例切成短 cue（script / ASR 共用）。
 */
export function allocateTimedCuesByCharWeight(
  parts: string[],
  startSec: number,
  endSec: number,
): SubtitleTimedCue[] {
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];
  const windowSec = Math.max(0.35, endSec - startSec);
  if (cleaned.length === 1) {
    return [{ startSec, endSec, text: cleaned[0]! }];
  }

  const totalChars =
    cleaned.reduce((sum, s) => sum + Math.max(1, s.length), 0) || 1;
  const cues: SubtitleTimedCue[] = [];
  let cursor = startSec;
  const minSegSec = 0.4;

  for (let i = 0; i < cleaned.length; i++) {
    const text = cleaned[i]!;
    const isLast = i === cleaned.length - 1;
    const weight = Math.max(1, text.length) / totalChars;
    const segDur = isLast
      ? Math.max(minSegSec, endSec - cursor)
      : Math.max(minSegSec, windowSec * weight);
    const segEnd = isLast ? endSec : Math.min(endSec, cursor + segDur);
    if (segEnd > cursor + 0.05) {
      cues.push({ startSec: cursor, endSec: segEnd, text });
    }
    cursor = segEnd;
  }

  if (cues.length === 0) {
    return [{ startSec, endSec, text: cleaned.join("") }];
  }
  cues[cues.length - 1]!.endSec = endSec;
  return cues;
}

/**
 * 将单镜对白拆成多句 SRT cue，按字数比例分配镜内时长（对齐口播出入点）。
 * 保留表头过滤；按句号/逗号/字数切短，避免整段同时烧录。
 */
export function splitDialogueIntoTimedCues(
  raw: string | undefined | null,
  startSec: number,
  endSec: number,
): SubtitleTimedCue[] {
  if (!raw?.trim()) return [];
  let t = raw.replace(/\r\n/g, "\n").trim();
  if (t === "—" || t === "-") return [];

  const lines = t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\d+\s+\d+\s*s?$/.test(l))
    .filter((l) => !/^镜\s*\d+/i.test(l));

  const body =
    lines.find((l) => /[：:]/.test(l)) ??
    lines.join(" ") ??
    t;

  const normalized = stripSubtitleSpeakerPrefix(
    body
      .replace(/-->/g, "→")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, BURN_IN_SUBTITLE_MAX_CHARS * 4),
  );
  if (!normalized) return [];

  const parts = splitSubtitleTextIntoBurnInParts(normalized);
  return allocateTimedCuesByCharWeight(parts, startSec, endSec);
}
