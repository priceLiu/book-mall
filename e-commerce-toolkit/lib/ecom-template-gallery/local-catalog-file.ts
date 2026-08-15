import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EcomTemplateGalleryCatalog } from "@/lib/ecom-template-gallery/types";

/** 打包快照：book-mall 导入在数据库不可写时也会落到同一路径 */
export function readLocalTemplateGalleryCatalog(): EcomTemplateGalleryCatalog {
  try {
    const path = resolve(
      process.cwd(),
      "lib/ecom-template-gallery/catalog.json",
    );
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw) as EcomTemplateGalleryCatalog;
    return { templates: data.templates ?? [] };
  } catch {
    return { templates: [] };
  }
}
