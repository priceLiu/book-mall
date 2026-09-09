/* eslint-disable no-console */
/**
 * 从 docs/姿势库md、docs/姿势库 大动作.md 导入文字姿势，并回填已有条目的性别 / 场景标签；同步 catalog.json。
 *
 *   cd book-mall && pnpm ecom:import-pose-library-md
 *   pnpm ecom:import-pose-library-md --dry-run
 *   pnpm ecom:import-pose-library-md --skip-md
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  attachPoseMeta,
  backfillLegacyPoseMeta,
  normalizePoseSceneTags,
  parsePoseLibraryMarkdown,
} from "../lib/ecom/ecom-pose-library-meta";
import {
  listAllPoseLibraryEntriesFromDb,
  readPoseLibraryCatalogJson,
  upsertPoseLibraryEntry,
  type EcomPoseLibraryEntry,
} from "../lib/ecom/ecom-pose-library-service";
import { prisma } from "../lib/prisma";

const ROOT = resolve(__dirname, "..", "..");
const POSE_MD = resolve(ROOT, "docs", "姿势库md");
const POSE_DRAMATIC_MD = resolve(ROOT, "docs", "姿势库 大动作.md");
const CATALOG_JSON = resolve(ROOT, "e-commerce-toolkit", "lib", "ecom-pose-library", "catalog.json");

const dryRun = process.argv.includes("--dry-run");
const skipMd = process.argv.includes("--skip-md");

function catalogEntryFromRow(
  row: ReturnType<typeof parsePoseLibraryMarkdown>[number],
  importedFrom: string,
): EcomPoseLibraryEntry {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    baseDescription: row.baseDescription,
    genders: row.genders,
    sceneTags: row.sceneTags,
    tags: {
      genders: row.genders,
      sceneTags: row.sceneTags,
      sourceKey: row.sourceKey,
      importedFrom,
    },
    scope: "platform",
    enabled: true,
    sortOrder: row.sortOrder,
    sourceImageKey: row.sourceKey,
  };
}

function writeCatalogJson(entries: EcomPoseLibraryEntry[]) {
  const poses = [...entries]
    .filter((e) => (e.scope ?? "platform") === "platform")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title, "zh-CN"))
    .map((e) => ({
      id: e.id,
      category: e.category,
      title: e.title,
      baseDescription: e.baseDescription,
      genders: e.genders,
      sceneTags: e.sceneTags,
      sortOrder: e.sortOrder ?? 0,
      ...(e.ossUrl ? { ossUrl: e.ossUrl, thumbUrl: e.thumbUrl ?? e.ossUrl } : {}),
    }));
  const payload = { poses };
  if (!dryRun) {
    writeFileSync(CATALOG_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
  console.log(`catalog.json → ${poses.length} 条${dryRun ? " (dry-run)" : ""}`);
}

async function importMarkdownFile(path: string, label: string) {
  const raw = readFileSync(path, "utf8");
  const rows = parsePoseLibraryMarkdown(raw);
  console.log(`解析 ${label}：${rows.length} 条`);
  for (const row of rows) {
    const entry = catalogEntryFromRow(row, label);
    if (dryRun) {
      console.log(`  [dry-run] upsert ${entry.id} · ${entry.title}`);
      continue;
    }
    await upsertPoseLibraryEntry(entry);
  }
}

async function importMarkdownRows() {
  await importMarkdownFile(POSE_MD, "docs/姿势库md");
  await importMarkdownFile(POSE_DRAMATIC_MD, "docs/姿势库 大动作.md");
}

function isMarkdownImportedPoseId(id: string): boolean {
  return /^(COMM|TRAV|DRAM)-[FM]-\d{2}$/.test(id);
}

async function backfillExistingEntries() {
  const rows = await prisma.ecomPoseLibraryEntry.findMany({
    where: { deletedAt: null, scope: "platform" },
  });
  let updated = 0;
  for (const row of rows) {
    if (isMarkdownImportedPoseId(row.id)) continue;
    const rawTags =
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : {};
    const tagsMissingMeta =
      !Array.isArray(rawTags.genders) ||
      !Array.isArray(rawTags.sceneTags) ||
      normalizePoseSceneTags(rawTags.sceneTags).length === 0;
    if (!tagsMissingMeta) continue;

    const entry = attachPoseMeta({
      id: row.id,
      category: row.category,
      title: row.title,
      baseDescription: row.baseDescription,
      ossUrl: row.ossUrl,
      thumbUrl: row.thumbUrl,
      sourceImageKey: row.sourceImageKey,
      tags: rawTags,
      scope: "platform",
      enabled: row.enabled,
      sortOrder: row.sortOrder,
    });
    const meta = backfillLegacyPoseMeta(entry);
    updated += 1;
    const next: EcomPoseLibraryEntry = {
      ...entry,
      genders: meta.genders,
      sceneTags: meta.sceneTags,
      tags: {
        ...rawTags,
        genders: meta.genders,
        sceneTags: meta.sceneTags,
      },
    };
    if (dryRun) {
      console.log(
        `  [dry-run] backfill ${entry.id} → genders=${meta.genders.join(",")} tags=${meta.sceneTags.join(",")}`,
      );
      continue;
    }
    await upsertPoseLibraryEntry(next);
  }

  console.log(`回填性别/标签：${updated} 条${dryRun ? " (dry-run)" : ""}`);
}

async function main() {
  if (!skipMd) {
    await importMarkdownRows();
  } else {
    console.log("跳过 markdown 导入 (--skip-md)");
  }
  await backfillExistingEntries();
  const all = await listAllPoseLibraryEntriesFromDb();
  const merged =
    all.length > 0 ? all : [...readPoseLibraryCatalogJson().poses.map((e) => ({ ...e, scope: "platform" as const }))];
  writeCatalogJson(merged);
  console.log("完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
