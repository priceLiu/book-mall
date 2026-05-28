/** 与 book-mall story-pro-character-asset-service 一致的 key 规范化 */
export function normalizeStoryProCharacterKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}
