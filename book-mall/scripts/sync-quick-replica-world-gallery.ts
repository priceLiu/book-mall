/* eslint-disable no-console */
/**
 * 从 World Labs Marble API 拉取 worlds:list（默认 30 条 SUCCEEDED），
 * 下载缩略图上传 OSS，并生成 builtin-world-gallery.json。
 *
 * 环境：book-mall/.env.local → WORLDLABS_API_KEY、OSS_* / OSS_PUBLIC_URL_BASE
 *
 * 使用：
 *   cd book-mall && pnpm qr:sync-world-gallery
 *   pnpm qr:sync-world-gallery --dry-run
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { uploadQuickReplicaBuiltinPreview } from "../lib/canvas/canvas-oss";
import {
  worldlabsAuthHeaders,
  WORLDLABS_DEFAULT_API_ROOT,
  type WorldlabsWorld,
} from "../lib/gateway/worldlabs-proxy";
import type { QrTemplateJson } from "../lib/quick-replica/qr-types";

const ROOT = resolve(__dirname, "..");
const OUT_JSON = resolve(ROOT, "content", "quick-replica", "builtin-world-gallery.json");
const URLS_JSON = resolve(ROOT, "content", "quick-replica", "builtin-world-gallery.urls.json");

const LIST_PAGE_SIZE = 30;

function extractPromptText(world: WorldlabsWorld): string {
  const wp = world.world_prompt;
  if (!wp || typeof wp !== "object") {
    return world.assets?.caption?.trim() || world.display_name;
  }
  const p = wp as Record<string, unknown>;
  if (typeof p.text_prompt === "string" && p.text_prompt.trim()) {
    return p.text_prompt.trim();
  }
  return world.assets?.caption?.trim() || world.display_name;
}

function buildTemplate(
  world: WorldlabsWorld,
  thumbnailUrl: string,
  sortOrder: number,
): QrTemplateJson {
  const now = new Date().toISOString();
  const promptText = extractPromptText(world);
  const modelKey =
    typeof world.model === "string" && world.model.trim()
      ? world.model.trim()
      : "marble-1.1";
  return {
    schemaVersion: 1,
    id: `qr-world-api-${world.world_id}`,
    category: "world",
    kind: "create-world",
    title: world.display_name?.trim() || promptText.slice(0, 48) || "Marble World",
    thumbnailUrl,
    source: "builtin",
    visibility: "public",
    reference: {
      slots: {},
      prompt: {
        text: promptText,
        locale: /[\u4e00-\u9fff]/.test(promptText) ? "zh" : "en",
      },
      model: {
        role: "IMAGE",
        modelKey,
        params: {
          world_id: world.world_id,
          world_marble_url: world.world_marble_url,
          tags: world.tags ?? [],
        },
      },
    },
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

async function fetchImageBuffer(
  url: string,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const lower = url.toLowerCase();
  const ext = lower.endsWith(".webp")
    ? "webp"
    : lower.endsWith(".png")
      ? "png"
      : "jpg";
  return { buf: Buffer.from(await res.arrayBuffer()), contentType, ext };
}

async function listWorlds(apiKey: string): Promise<WorldlabsWorld[]> {
  const url = `${WORLDLABS_DEFAULT_API_ROOT}/marble/v1/worlds:list`;
  const res = await fetch(url, {
    method: "POST",
    headers: worldlabsAuthHeaders(apiKey),
    body: JSON.stringify({
      page_size: LIST_PAGE_SIZE,
      status: "SUCCEEDED",
      sort_by: "created_at",
    }),
  });
  const json = (await res.json()) as { worlds?: WorldlabsWorld[]; detail?: string };
  if (!res.ok) {
    throw new Error(json.detail ?? `worlds:list HTTP ${res.status}`);
  }
  return json.worlds ?? [];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.WORLDLABS_API_KEY?.trim();
  if (!apiKey) {
    console.error("[sync-quick-replica-world-gallery] WORLDLABS_API_KEY required in .env.local");
    process.exit(1);
  }

  console.log(`[sync] fetching up to ${LIST_PAGE_SIZE} worlds…`);
  const worlds = await listWorlds(apiKey);
  if (worlds.length === 0) {
    console.error("[sync-quick-replica-world-gallery] worlds:list returned empty");
    process.exit(1);
  }

  const urlMap: Record<string, string> = {};
  const templates: QrTemplateJson[] = [];
  let ok = 0;

  for (let i = 0; i < worlds.length; i += 1) {
    const world = worlds[i]!;
    const id = `qr-world-api-${world.world_id}`;
    const sortOrder = 100 + i;
    const sourceThumb =
      world.assets?.thumbnail_url?.trim() ||
      world.assets?.imagery?.pano_url?.trim() ||
      null;

    if (!sourceThumb) {
      console.warn(`[skip] ${id} no thumbnail`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${id} ← ${sourceThumb}`);
      templates.push(buildTemplate(world, sourceThumb, sortOrder));
      ok += 1;
      continue;
    }

    try {
      const { buf, contentType, ext } = await fetchImageBuffer(sourceThumb);
      const ossUrl = await uploadQuickReplicaBuiltinPreview({
        id,
        buf,
        contentType,
        ext,
      });
      urlMap[id] = ossUrl;
      templates.push(buildTemplate(world, ossUrl, sortOrder));
      ok += 1;
      console.log(`[ok] ${id} → ${ossUrl}`);
    } catch (e) {
      console.error(`[fail] ${id}`, e);
    }
  }

  if (dryRun) {
    console.log(`[dry-run] would write ${templates.length} templates → ${OUT_JSON}`);
    return;
  }

  if (templates.length === 0) {
    console.error("[sync-quick-replica-world-gallery] no templates generated");
    process.exit(1);
  }

  writeFileSync(OUT_JSON, JSON.stringify(templates, null, 2) + "\n");
  writeFileSync(URLS_JSON, JSON.stringify(urlMap, null, 2) + "\n");
  console.log(
    `[sync-quick-replica-world-gallery] done · api=${worlds.length} saved=${templates.length} → ${OUT_JSON}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
