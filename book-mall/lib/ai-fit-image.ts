/** AI 试衣上传：校验 Data URL / base64 图片体积与类型 */

export const AI_FIT_MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const DATA_URL_RE =
  /^data:(image\/(?:jpeg|jpg|png|webp));base64,([\s\S]+)$/i;

export type ParsedFitImage =
  | { ok: true; mime: "image/jpeg" | "image/png" | "image/webp"; dataUrl: string }
  | { ok: false; error: string };

function normalizeMime(m: string): "image/jpeg" | "image/png" | "image/webp" | null {
  const x = m.toLowerCase();
  if (x === "image/jpg" || x === "image/jpeg") return "image/jpeg";
  if (x === "image/png") return "image/png";
  if (x === "image/webp") return "image/webp";
  return null;
}

/**
 * 接受完整 Data URL；若仅有裸 base64，须配合 `mime`（默认 image/jpeg）。
 */
export function parseFitImageDataUrl(
  raw: string,
  mimeFallback: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): ParsedFitImage {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "empty" };

  const m = DATA_URL_RE.exec(trimmed);
  if (m) {
    const mime = normalizeMime(m[1]);
    if (!mime) return { ok: false, error: "unsupported_mime" };
    let buf: Buffer;
    try {
      buf = Buffer.from(m[2].replace(/\s/g, ""), "base64");
    } catch {
      return { ok: false, error: "invalid_base64" };
    }
    if (buf.length === 0 || buf.length > AI_FIT_MAX_IMAGE_BYTES) {
      return { ok: false, error: "too_large" };
    }
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    return { ok: true, mime, dataUrl };
  }

  const cleaned = trimmed.replace(/\s/g, "");
  if (!/^[a-z0-9+/]+=*$/i.test(cleaned)) {
    return { ok: false, error: "invalid_data_url" };
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(cleaned, "base64");
  } catch {
    return { ok: false, error: "invalid_base64" };
  }
  if (buf.length === 0 || buf.length > AI_FIT_MAX_IMAGE_BYTES) {
    return { ok: false, error: "too_large" };
  }
  const dataUrl = `data:${mimeFallback};base64,${buf.toString("base64")}`;
  return { ok: true, mime: mimeFallback, dataUrl };
}
