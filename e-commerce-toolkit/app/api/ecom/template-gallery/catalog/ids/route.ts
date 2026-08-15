import { NextResponse } from "next/server";

import { readLocalTemplateGalleryCatalog } from "@/lib/ecom-template-gallery/local-catalog-file";

export const dynamic = "force-dynamic";

/**
 * BFF 不可达时的 id 清单兜底。快照为构建期产物、缺少此后导入的分类，
 * 故随 `source: "local"` 一并返回，调用方须提示判定不可信。
 */
export async function GET(req: Request) {
  const category =
    new URL(req.url).searchParams.get("category")?.trim() || undefined;
  const ids = readLocalTemplateGalleryCatalog()
    .templates.filter((t) => !category || t.category === category)
    .map((t) => t.id);

  return NextResponse.json(
    { category: category ?? null, ids, source: "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
