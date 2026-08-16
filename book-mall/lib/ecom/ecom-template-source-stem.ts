/**
 * 模板区导入 · 源图 URL / UUID ↔ catalog id 的 stem（文件名前 12 字符）。
 * 与 e-commerce-toolkit/lib/ecom-template-gallery/html-parse.ts 规则一致。
 */

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** catalog id 中 `{品类}-{三位序号}-{stem}` 的 stem 段 */
export function catalogEntryStemFromId(id: string): string | null {
  const m = id.match(/^(.+)-(\d{3})-(.+)$/);
  return m?.[3] ?? null;
}

export function fileStemFromUrl(url: string): string {
  const path = url.split("?")[0] ?? url;
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.[^.]+$/, "").slice(0, 12);
}

/**
 * 管理后台 / 对账：粘贴 yibaiaigc 源链接、完整 UUID 或 stem 片段。
 */
export function parseSourceLookupQuery(raw: string): string | null {
  const q = raw.trim();
  if (!q) return null;

  if (/^https?:\/\//i.test(q) || q.includes("yibaiaigc.com")) {
    const stem = fileStemFromUrl(q);
    return stem.length >= 8 ? stem : null;
  }

  const uuidInText = q.match(UUID_RE);
  if (uuidInText) {
    const stem = uuidInText[0]!.slice(0, 12);
    return stem.length >= 8 ? stem : null;
  }

  const noExt = q.replace(/\.(png|jpe?g|webp|mp4|webm)$/i, "");
  if (/^[0-9a-f-]{8,}$/i.test(noExt)) {
    return noExt.slice(0, 12);
  }

  return noExt.length >= 8 ? noExt.slice(0, 12) : null;
}

export function catalogIdMatchesSourceStem(catalogId: string, stem: string): boolean {
  if (!stem) return false;
  return catalogEntryStemFromId(catalogId) === stem;
}
