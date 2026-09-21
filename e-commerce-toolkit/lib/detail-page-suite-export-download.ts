"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";

async function downloadDetailPageSuiteExportZip(
  basePath: string,
  projectId: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${basePath}/projects/${projectId}/export`, {
      method: "GET",
      credentials: "include",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg === "fetch failed" ? "与服务器连接中断，请稍后重试。" : msg);
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    let message = `导出失败 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === "string") message = data.error;
    } catch {
      /* non-json */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = utf8Match
    ? decodeURIComponent(utf8Match[1]!)
    : plainMatch
      ? plainMatch[1]!
      : "detail-page-suite-export.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDetailPageSuiteHitExportZip(projectId: string): Promise<void> {
  return downloadDetailPageSuiteExportZip("api/sso/tools/ecom/detail-page-suite-hit", projectId);
}

export function downloadDetailPageSuiteReplicaExportZip(projectId: string): Promise<void> {
  return downloadDetailPageSuiteExportZip(
    "api/sso/tools/ecom/detail-page-suite-replica",
    projectId,
  );
}
