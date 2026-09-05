/** 纯路径校验/解析（无 Node fs），客户端 Markdown 预览可安全 import */

export function isAllowedRepoDocPath(relativePath: string): boolean {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..")) return false;
  return (
    trimmed.startsWith("docs/") || trimmed.startsWith("book-mall/doc/")
  );
}

const REPO_DOC_ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico)$/i;

/** docs/ 与 book-mall/doc/ 下的静态资源（供 Markdown 预览 img 引用） */
export function isAllowedRepoDocAssetPath(relativePath: string): boolean {
  const trimmed = relativePath.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..")) return false;
  if (!REPO_DOC_ASSET_EXT.test(trimmed)) return false;
  return isAllowedRepoDocPath(trimmed);
}

/** 将 Markdown 内相对 img src 解析为仓库内 docs/ 路径 */
export function resolveRepoDocAssetPath(
  docPath: string,
  src: string,
): string | null {
  const trimmedSrc = src.trim();
  if (!trimmedSrc || /^https?:\/\//i.test(trimmedSrc) || trimmedSrc.startsWith("data:")) {
    return null;
  }
  if (trimmedSrc.startsWith("/")) return null;

  const docDir = docPath.trim().replace(/^\/+/, "").replace(/\/[^/]+$/, "");
  const rel = trimmedSrc.replace(/^\.\//, "");
  const assetPath = docDir ? `${docDir}/${rel}` : rel;
  return isAllowedRepoDocAssetPath(assetPath) ? assetPath : null;
}
