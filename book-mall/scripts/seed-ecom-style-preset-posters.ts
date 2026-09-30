/* eslint-disable no-console */
/**
 * 卖点版式库缩略图：从 Meitu 参考 URL 拉取并上传自有 OSS，回写 EcomStylePresetEntry。
 *
 *   cd book-mall && dotenv -e .env.local -- tsx scripts/seed-ecom-style-preset-posters.ts
 *   ... --dry-run
 *   ... --skip-existing
 *   ... --urls-only   （OSS 已有对象、仅回写 DB thumbUrl/referenceUrl）
 */
import { buildEcomStylePresetOssKey, buildEcomStylePresetThumbOssKey } from "../lib/canvas/canvas-constants";
import { ossPublicUrlForKeyFromEnv } from "../lib/canvas/canvas-oss";
import { patchStylePresetEntry } from "../lib/ecom/ecom-style-preset/db-service";
import { invalidateStylePresetCache } from "../lib/ecom/ecom-style-preset/runtime";
import { invalidateStylePresetMediaResolveCache } from "../lib/ecom/ecom-style-preset/resolve-media";
import { uploadEcomStylePresetAssets } from "../lib/canvas/canvas-oss";
import { prisma } from "../lib/prisma";

const MEITU_POSTER_BASE = "https://xiuxiu-pro-new.meitudata.com/poster";

/** 与迁移 20260930140000 中 sellpoint_layout id 一一对应 */
const MEITU_POSTER_BY_PRESET_ID: Record<string, string> = {
  "sp-single-frame": "a2595470015d0ca47b07549ff243af45.png",
  "sp-full-bleed": "741b00186187d5d4434951dddf274b34.png",
  "sp-detail-magnifier": "8d2a439c28b42c227e366189a0324e0e.png",
  "sp-bottom-banner": "78a6faf98e17f60196a5e51b3c693017.png",
  "sp-split-vertical": "e86c80ef8cd3c308bd750b7f79d7bc90.png",
  "sp-sidebar-tags": "4ddd4bbad8065bde4036f6a286762015.png",
  "sp-scene-icons": "45d89a6bc5e09dd56b65120671ae6697.png",
  "sp-card-orbit": "6088fb8de6964d3febcd5da8a638e646.png",
  "sp-grid-array": "a391d81f1be07d07220d8056a20a3be6.png",
  "sp-arch-card": "3c9054619ba3f2239a7c3afe1bb493fb.png",
  "sp-solid-zones": "695ab4c1d497af9fa9cf9eddf5750571.png",
  "sp-floating-stats": "d784aa41fef0d3eb72e88db904214aeb.png",
  "sp-triple-float": "9c56da71ad0394de2270e3f575b71c11.png",
  "sp-asymmetric-trio": "7e7c34c754ae6e38f4b141392ba72231.png",
  "sp-cycle-icons": "9a2d7e68f97872aad4784c444cabf527.png",
  "sp-multi-variant-float": "8906608591ea9a9197df07ff6f5e3d49.png",
  "sp-left-bottom-icons": "639297bdbc4f08f1e1a10701b09c2411.png",
  "sp-scene-color-bar": "9805692b25bbeca21693e70742672ea9.png",
  "sp-quad-card": "111d0aa9a5587afa4c9897795375eeb0.png",
  "sp-line-window-scene": "fed8cc28cacc4d73dd52f2a3bbee47d8.png",
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipExisting = process.argv.includes("--skip-existing");
  const urlsOnly = process.argv.includes("--urls-only");
  let ok = 0;
  let skipped = 0;

  if (urlsOnly) {
    for (const id of Object.keys(MEITU_POSTER_BY_PRESET_ID)) {
      const row = await prisma.ecomStylePresetEntry.findUnique({ where: { id } });
      if (!row) {
        console.warn(`[urls-only] missing row: ${id}`);
        continue;
      }
      if (skipExisting && row.thumbUrl?.trim()) {
        skipped += 1;
        continue;
      }
      let thumbUrl: string;
      let referenceUrl: string;
      try {
        thumbUrl = ossPublicUrlForKeyFromEnv(buildEcomStylePresetThumbOssKey(id));
        referenceUrl = ossPublicUrlForKeyFromEnv(buildEcomStylePresetOssKey(id, "png"));
      } catch (e) {
        console.error(`[urls-only] ${id} OSS env:`, e instanceof Error ? e.message : e);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] ${id} -> ${thumbUrl}`);
        ok += 1;
        continue;
      }
      await patchStylePresetEntry(id, { thumbUrl, referenceUrl });
      console.log(`[urls-only] ${id}`);
      ok += 1;
    }
    if (!dryRun && ok > 0) {
      invalidateStylePresetCache();
      invalidateStylePresetMediaResolveCache();
    }
    console.log(`Done urls-only: ${ok}, skipped ${skipped}`);
    return;
  }

  for (const [id, fileName] of Object.entries(MEITU_POSTER_BY_PRESET_ID)) {
    const row = await prisma.ecomStylePresetEntry.findUnique({ where: { id } });
    if (!row) {
      console.warn(`[seed-style-presets] missing row: ${id}`);
      continue;
    }
    if (skipExisting && row.thumbUrl?.trim()) {
      skipped += 1;
      console.log(`[skip] ${id} already has thumb`);
      continue;
    }

    const url = `${MEITU_POSTER_BASE}/${fileName}`;
    if (dryRun) {
      console.log(`[dry-run] ${id} <- ${url}`);
      ok += 1;
      continue;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[fail] ${id} fetch ${res.status} ${url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    const ext = fileName.endsWith(".png") ? "png" : "jpg";
    const { url: ossUrl, thumbUrl } = await uploadEcomStylePresetAssets({
      id,
      buf,
      contentType,
      ext,
    });
    await patchStylePresetEntry(id, { referenceUrl: ossUrl, thumbUrl });
    console.log(`[ok] ${id} -> ${thumbUrl ?? ossUrl}`);
    ok += 1;
  }

  if (!dryRun && ok > 0) {
    invalidateStylePresetCache();
    invalidateStylePresetMediaResolveCache();
  }
  console.log(`Done: uploaded ${ok}, skipped ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
