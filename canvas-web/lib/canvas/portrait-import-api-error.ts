/** 将 fetch 错误体转为用户可读文案（避免整页 HTML 404 进 UI） */
export function formatPortraitImportApiError(
  raw: string,
  status: number,
  apiPath?: string,
): string {
  const trimmed = raw.trim();
  const isHtml =
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("next-error-h1") ||
    trimmed.includes("This page could not be found");

  if (isHtml) {
    if (status === 404) {
      const path = apiPath ?? "/api/canvas/portrait/…";
      return (
        `主站接口未找到（404）：${path}\n\n` +
        "请确认 book-mall 已部署含「私域人像入库」的最新版本，并完成数据库迁移（ProjectAssetKind · PRIVATE_PORTRAIT）。\n" +
        "若刚修复构建错误，请重新发布 book-mall 服务后再试。"
      );
    }
    return `主站返回异常页面（HTTP ${status}），请稍后重试或联系管理员。`;
  }

  try {
    const j = JSON.parse(trimmed) as {
      error?: string;
      message?: string;
      code?: string;
    };
    const msg = j.message ?? j.error ?? j.code;
    if (msg) return msg;
  } catch {
    /* keep raw */
  }

  if (trimmed.length > 400) {
    return `${trimmed.slice(0, 400)}…`;
  }
  return trimmed || `HTTP ${status}`;
}
