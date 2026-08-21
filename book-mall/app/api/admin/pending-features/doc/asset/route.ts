import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { repoRootFromBookMall } from "@/lib/admin/read-repo-doc";
import { isAllowedRepoDocAssetPath } from "@/lib/admin/read-repo-doc-path";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function GET(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  const assetPath = new URL(request.url).searchParams.get("path")?.trim() ?? "";
  if (!assetPath || !isAllowedRepoDocAssetPath(assetPath)) {
    return NextResponse.json({ error: "资源不存在或路径不允许" }, { status: 404 });
  }

  const root = repoRootFromBookMall();
  const full = path.resolve(root, assetPath);
  if (!full.startsWith(root + path.sep) && full !== root) {
    return NextResponse.json({ error: "资源不存在或路径不允许" }, { status: 404 });
  }

  try {
    const buf = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }
}
