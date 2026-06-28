/**
 * 从首轮批次 Markdown 提取 4 份永久冻结档案
 */
import { SCRIPT_STUDIO_BIBLE_FILES } from "./script-studio-prompts";

/** 首轮输出中、第一集标题之前的部分视为冻结档案区 */
export function extractScriptStudioFrozenBiblesMd(batchMd: string): string {
  const raw = batchMd.trim();
  if (!raw) return "";

  const firstEpisode = raw.search(/^#\s*第\s*\d+\s*集/m);
  if (firstEpisode === 0) return "";
  const prefix =
    firstEpisode > 0 ? raw.slice(0, firstEpisode).trim() : raw;

  if (!prefix) return "";

  const hits = SCRIPT_STUDIO_BIBLE_FILES.filter((title) =>
    prefix.includes(title),
  );
  if (hits.length >= 2) return prefix;

  // 兜底：按文件1~4 分段
  const chunks: string[] = [];
  for (const title of SCRIPT_STUDIO_BIBLE_FILES) {
    const re = new RegExp(
      `(?:^|\\n)(?:#{1,3}\\s*)?(?:文件\\d+[：:]\\s*)?${escapeRegExp(title)}[\\s\\S]*?(?=\\n(?:#{1,3}\\s*)?(?:文件\\d+[：:]|${escapeRegExp(SCRIPT_STUDIO_BIBLE_FILES[0]!)}|#\\s*第\\s*\\d+\\s*集)|$)`,
      "m",
    );
    const m = prefix.match(re);
    if (m?.[0]?.trim()) chunks.push(m[0].trim());
  }
  return chunks.length > 0 ? chunks.join("\n\n---\n\n") : prefix;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
