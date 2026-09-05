const DEFAULT_TITLE = "happy music";
const GENERIC_LABELS = new Set(["音效设计", "音频"]);

/** 单行展示 · 迷你播放器宽度内 truncate */
const MAX_DIALOGUE_TITLE_LEN = 96;

function normalizeDialogueTitle(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;
  if (
    (text.startsWith("「") && text.endsWith("」")) ||
    (text.startsWith("“") && text.endsWith("”")) ||
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length > MAX_DIALOGUE_TITLE_LEN) {
    return `${text.slice(0, MAX_DIALOGUE_TITLE_LEN - 1)}…`;
  }
  return text;
}

function titleFromOssUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").pop()?.split("?")[0];
    if (!base) return null;
    return decodeURIComponent(base.replace(/\.[^.]+$/, ""));
  } catch {
    return null;
  }
}

/** OSS 文件名像 taskId / base64 片段时不当作标题 */
export function isOpaqueGeneratedAudioFilename(name: string): boolean {
  const base = name.trim();
  if (!base) return true;
  if (/[\u4e00-\u9fff]/.test(base)) return false;
  if (/[\s,，。！？、；：]/.test(base)) return false;
  if (/ETEFNRT/i.test(base)) return true;
  if (base.length >= 28 && /^[A-Za-z0-9+/=_-]+$/.test(base)) return true;
  if (/AAA[A-Z0-9+/]{8,}/.test(base)) return true;
  return false;
}

export function resolveLibtvAudioDisplayTitle(opts: {
  label?: string;
  dockInput?: string;
  dialogueText?: string;
  ossUrl?: string;
  hasAudio: boolean;
}): string {
  const label = opts.label?.trim();
  if (label && !GENERIC_LABELS.has(label)) return label;

  const dialogue =
    normalizeDialogueTitle(opts.dialogueText ?? "") ??
    normalizeDialogueTitle(opts.dockInput ?? "");
  if (dialogue) return dialogue;

  if (!opts.hasAudio) return DEFAULT_TITLE;

  if (opts.ossUrl) {
    const fromUrl = titleFromOssUrl(opts.ossUrl);
    if (fromUrl && !isOpaqueGeneratedAudioFilename(fromUrl)) return fromUrl;
  }

  return label || DEFAULT_TITLE;
}
