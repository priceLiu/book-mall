const DATA_URL_RE =
  /^data:(image\/(?:jpeg|jpg|png|webp|bmp|heic));base64,([\s\S]+)$/i;

export function parseImageDataUrl(
  raw: string,
): { buffer: Buffer; contentType: string } | null {
  const trimmed = raw.trim();
  const m = DATA_URL_RE.exec(trimmed);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const contentType =
    mime === "image/jpg" || mime === "image/jpeg" ? "image/jpeg" : mime;
  try {
    const buf = Buffer.from(m[2].replace(/\s/g, ""), "base64");
    if (buf.length === 0 || buf.length > 6 * 1024 * 1024) return null;
    return { buffer: buf, contentType };
  } catch {
    return null;
  }
}
