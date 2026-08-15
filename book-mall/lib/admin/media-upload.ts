const EXT_BY_CONTENT_TYPE: Array<[RegExp, string]> = [
  [/png/, "png"],
  [/webp/, "webp"],
  [/gif/, "gif"],
  [/mp4/, "mp4"],
  [/webm/, "webm"],
  [/quicktime|mov/, "mov"],
];

/** 文件名后缀优先：浏览器给的 MIME 常是 application/octet-stream */
export function pickUploadExt(contentType: string, filename: string): string {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(filename.trim())?.[1];
  if (fromName) return fromName.toLowerCase();
  for (const [pattern, ext] of EXT_BY_CONTENT_TYPE) {
    if (pattern.test(contentType)) return ext;
  }
  return "jpg";
}
