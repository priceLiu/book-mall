import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 读本机 catalog.json（book-mall 导入写入同一路径；BFF 不可达时用于核对落库状态） */
export async function GET() {
  try {
    const path = resolve(
      process.cwd(),
      "lib/ecom-template-gallery/catalog.json",
    );
    const raw = readFileSync(path, "utf8");
    return NextResponse.json(JSON.parse(raw), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}
