import { createHash } from "node:crypto";

/** 归一化 URL 用于去重（去掉 query/hash） */
export function normalizePoseSourceImageUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

/** 从 model-shot 句式或全文提取姿势描述 */
export function extractPoseDescriptionFromPrompt(prompt: string): string {
  const text = prompt.trim();
  if (!text) return "";

  const wearingMatch = text.match(/穿着[^，。]+，([^，。]+)，/);
  if (wearingMatch?.[1]?.trim()) {
    const segment = wearingMatch[1].trim();
    if (!segment.startsWith("场景") && !segment.startsWith("道具")) {
      return segment;
    }
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
  return lines[0]!.length > 120 ? `${lines[0]!.slice(0, 120)}…` : lines[0]!;
}

export function buildAutoPoseTitle(opts: {
  savePrompt: boolean;
  poseDescription?: string;
  now?: Date;
}): string {
  const d = opts.now ?? new Date();
  const stamp = `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  if (opts.savePrompt && opts.poseDescription?.trim()) {
    const excerpt = opts.poseDescription.trim().replace(/\s+/g, " ").slice(0, 16);
    return `${excerpt} ·${stamp}`;
  }
  return `姿势参考 ·${stamp}`;
}

export function buildPoseSourceImageKeyFromUrl(url: string): string {
  return `url:${normalizePoseSourceImageUrl(url)}`;
}

export function buildPoseSourceImageKeyFromBuffer(buf: Buffer): string {
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

export function nextPlatformPoseId(category: string): string {
  const safe = category.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "A";
  const suffix = Date.now().toString(36).slice(-6);
  return `PL-${safe}-${suffix}`;
}
