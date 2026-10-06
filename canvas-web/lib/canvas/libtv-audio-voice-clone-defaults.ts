/** 画布 · 音色克隆弹窗默认展示名 */
export function defaultLibtvCloneVoiceDisplayName(sourceLabel: string): string {
  const raw = sourceLabel.trim() || "参考音频";
  const base = raw.replace(/^分离音频$/u, "参考音频");
  const short = base.length > 14 ? `${base.slice(0, 14)}…` : base;
  const now = new Date();
  const stamp = [
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const hm = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
  return `克隆·${short}·${stamp}${hm}`;
}

export const LIBTV_VOICE_CLONE_PROMPT_MAX = 1000;
