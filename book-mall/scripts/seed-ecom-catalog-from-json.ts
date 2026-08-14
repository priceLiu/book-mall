/* eslint-disable no-console */
/**
 * 将 e-commerce-toolkit catalog.json 种子写入 Prisma。
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-ecom-catalog-from-json.ts
 */
import { readTemplateGalleryCatalog, upsertTemplateGalleryEntry } from "../lib/ecom/ecom-template-gallery-service";
import {
  readModelLibraryCatalogJson,
  upsertModelLibraryEntry,
} from "../lib/ecom/ecom-model-library-service";

async function main() {
  const templates = readTemplateGalleryCatalog().templates;
  console.log(`[seed-ecom] templates to upsert: ${templates.length}`);
  let tOk = 0;
  for (const entry of templates) {
    await upsertTemplateGalleryEntry(entry);
    tOk += 1;
    if (tOk % 50 === 0 || tOk === templates.length) {
      console.log(`[seed-ecom] templates ${tOk}/${templates.length}`);
    }
  }

  const models = readModelLibraryCatalogJson().models;
  console.log(`[seed-ecom] models to upsert: ${models.length}`);
  let mOk = 0;
  for (const entry of models) {
    await upsertModelLibraryEntry(entry);
    mOk += 1;
    if (mOk % 50 === 0 || mOk === models.length) {
      console.log(`[seed-ecom] models ${mOk}/${models.length}`);
    }
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
