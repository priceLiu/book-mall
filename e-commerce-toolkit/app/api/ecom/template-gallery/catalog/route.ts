import { NextResponse } from "next/server";

import { readLocalTemplateGalleryCatalog } from "@/lib/ecom-template-gallery/local-catalog-file";

export const dynamic = "force-dynamic";

/** 读本机 catalog.json（book-mall 导入写入同一路径；BFF 不可达时用于核对落库状态） */
export async function GET(req: Request) {
  const catalog = readLocalTemplateGalleryCatalog();
  const category = new URL(req.url).searchParams.get("category")?.trim();
  const templates = category
    ? catalog.templates.filter((t) => t.category === category)
    : catalog.templates;

  return NextResponse.json(
    { templates },
    { headers: { "Cache-Control": "no-store" } },
  );
}
