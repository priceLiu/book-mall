import { NextResponse } from "next/server";

import { readLocalTemplateGalleryCatalog } from "@/lib/ecom-template-gallery/local-catalog-file";
import type { EcomTemplateCategorySummaryRow } from "@/lib/ecom-template-gallery/types";

export const dynamic = "force-dynamic";

/** BFF 不可达时的分类概览兜底：由打包快照现算 */
export async function GET() {
  const byCategory = new Map<string, EcomTemplateCategorySummaryRow>();
  for (const t of readLocalTemplateGalleryCatalog().templates) {
    const row = byCategory.get(t.category) ?? {
      category: t.category,
      image: 0,
      video: 0,
      total: 0,
    };
    if (t.mediaKind === "video") row.video += 1;
    else row.image += 1;
    row.total += 1;
    byCategory.set(t.category, row);
  }

  return NextResponse.json(
    { categories: Array.from(byCategory.values()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
