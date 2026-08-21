import path from "node:path";

import {
  isAllowedRepoDocPath,
  isAllowedRepoDocAssetPath,
  resolveRepoDocAssetPath,
} from "@/lib/admin/read-repo-doc-path";

export {
  isAllowedRepoDocPath,
  isAllowedRepoDocAssetPath,
  resolveRepoDocAssetPath,
} from "@/lib/admin/read-repo-doc-path";

/** monorepo 根目录（book-mall 的上一级） */
export function repoRootFromBookMall(): string {
  return path.resolve(process.cwd(), "..");
}

/** 功能名 = 文件名（不含 .md） */
export function titleFromDocPath(docPath: string): string {
  const base = path.basename(docPath.trim());
  return base.endsWith(".md") ? base.slice(0, -3) : base;
}

/** 取 Markdown 首段非标题正文作为简要描述 */
export function extractDocSummary(markdown: string, maxLen = 280): string {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || /^#+\s/.test(t)) continue;
    if (/^[-|]/.test(t)) continue;
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  }
  return "";
}

export type RepoDocMarkdownEntry = {
  docPath: string;
  title: string;
  description: string;
};

async function walkMarkdownFiles(
  dir: string,
  relPrefix: string,
): Promise<string[]> {
  const fs = await import("node:fs/promises");
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdownFiles(full, rel)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(`docs/${rel}`);
    }
  }
  return out;
}

/** 扫描仓库 docs/ 下全部 .md（含子目录） */
export async function scanRepoDocsMarkdownFiles(): Promise<RepoDocMarkdownEntry[]> {
  const docsDir = path.join(repoRootFromBookMall(), "docs");
  const paths = (await walkMarkdownFiles(docsDir, "")).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );

  const out: RepoDocMarkdownEntry[] = [];
  for (const docPath of paths) {
    const content = await readRepoDoc(docPath);
    out.push({
      docPath,
      title: titleFromDocPath(docPath),
      description: content ? extractDocSummary(content) : "",
    });
  }
  return out;
}

export type RepoDocFileTimes = {
  createdAt: string;
  updatedAt: string;
};

/** 仓库文档文件的创建/修改时间（本地 filesystem stat） */
export async function getRepoDocFileTimes(
  relativePath: string,
): Promise<RepoDocFileTimes | null> {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..")) return null;
  if (!isAllowedRepoDocPath(trimmed)) return null;

  const root = repoRootFromBookMall();
  const full = path.resolve(root, trimmed);
  if (!full.startsWith(root + path.sep) && full !== root) return null;

  try {
    const fs = await import("node:fs/promises");
    const stat = await fs.stat(full);
    const created =
      stat.birthtimeMs > 0 && stat.birthtime.getFullYear() > 1970
        ? stat.birthtime
        : stat.ctime;
    return {
      createdAt: created.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * 读取仓库内文档（仅限 docs/ 与 book-mall/doc/ 前缀，防路径穿越）。
 */
export async function readRepoDoc(relativePath: string): Promise<string | null> {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  if (trimmed.includes("..")) return null;
  if (!isAllowedRepoDocPath(trimmed)) return null;

  const root = repoRootFromBookMall();
  const full = path.resolve(root, trimmed);
  if (!full.startsWith(root + path.sep) && full !== root) return null;

  try {
    const fs = await import("node:fs/promises");
    return await fs.readFile(full, "utf8");
  } catch {
    return null;
  }
}
