/* eslint-disable no-console */
/**
 * 从 World Labs 官方公开池（api/v1 worlds:by-tag, curated）拉取样本，
 * 下载缩略图上传 OSS，并生成 builtin-world-gallery.json。
 *
 * 环境：book-mall/.env.local → OSS_* / OSS_PUBLIC_URL_BASE
 *
 * 使用：
 *   cd book-mall && pnpm qr:sync-world-gallery
 *   pnpm qr:sync-world-gallery --dry-run
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

import { uploadQuickReplicaBuiltinPreview } from "../lib/canvas/canvas-oss";
import type { QrTemplateJson } from "../lib/quick-replica/qr-types";

const ROOT = resolve(__dirname, "..");
const OUT_JSON = resolve(ROOT, "content", "quick-replica", "builtin-world-gallery.json");
const URLS_JSON = resolve(ROOT, "content", "quick-replica", "builtin-world-gallery.urls.json");

const OFFICIAL_API_ROOT = "https://api.worldlabs.ai/api/v1";
const OFFICIAL_TAG = "curated";
const LIST_PAGE_SIZE = 24;
const MAX_PAGES = 2;

type OfficialWorld = {
  id: string;
  display_name?: string | null;
  model?: string | null;
  status?: string | null;
  source?: string | null;
  tags?: string[] | null;
  generation_input?: {
    prompt?: {
      text_prompt?: string | null;
    } | null;
  } | null;
  generation_output?: {
    mpi_url?: string | null;
    spz_urls?: Record<string, string> | null;
  } | null;
};

function officialWorldMarbleUrl(worldId: string): string {
  return `https://marble.worldlabs.ai/world/${worldId}`;
}

function extractPromptText(world: OfficialWorld): string {
  const text = world.generation_input?.prompt?.text_prompt?.trim();
  if (text) return text;
  return world.display_name?.trim() || "Marble World";
}

function extractThumbnailUrl(world: OfficialWorld): string | null {
  const base = world.generation_output?.mpi_url?.trim();
  if (!base) return null;
  return `${base}/thumbnail.webp`;
}

function buildTemplate(
  world: OfficialWorld,
  thumbnailUrl: string,
  sourceThumbnailUrl: string,
  sortOrder: number,
  thumbMeta?: { width: number; height: number },
): QrTemplateJson {
  const now = new Date().toISOString();
  const promptText = extractPromptText(world);
  const worldId = world.id.trim();
  const modelKey =
    typeof world.model === "string" && world.model.trim()
      ? world.model.trim()
      : "marble-1.1";
  return {
    schemaVersion: 1,
    id: `qr-world-api-${worldId}`,
    category: "world",
    kind: "create-world",
    title: world.display_name?.trim() || promptText.slice(0, 48) || "Marble World",
    thumbnailUrl,
    source: "builtin",
    visibility: "public",
    reference: {
      slots: {
        sceneImages: [{ url: thumbnailUrl, label: "主场景" }],
      },
      prompt: {
        text: promptText,
        locale: /[\u4e00-\u9fff]/.test(promptText) ? "zh" : "en",
      },
      model: {
        role: "IMAGE",
        modelKey,
        params: {
          world_id: worldId,
          world_marble_url: officialWorldMarbleUrl(worldId),
          tags: world.tags ?? [],
          source: world.source ?? "web_ui",
          status: world.status ?? null,
          splat_urls: world.generation_output?.spz_urls ?? {},
          thumbnail_source_url: sourceThumbnailUrl,
          thumb_width: thumbMeta?.width ?? null,
          thumb_height: thumbMeta?.height ?? null,
          pano_url: world.generation_output?.posed_panos_url ?? null,
          collider_mesh_url: world.generation_output?.collider_mesh_url ?? null,
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

/** 列表接口只含 100k/150k；完整档位（含 full_res）须逐条 GET worlds/{id}。 */
async function fetchOfficialWorldDetail(worldId: string): Promise<OfficialWorld | null> {
  const id = worldId.trim();
  if (!id) return null;
  const res = await fetch(`${OFFICIAL_API_ROOT}/worlds/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const json = (await res.json()) as OfficialWorld & { detail?: string };
  if (!res.ok) {
    console.warn(`[detail] ${id} HTTP ${res.status} ${json.detail ?? ""}`);
    return null;
  }
  return json;
}

async function listOfficialWorlds(): Promise<OfficialWorld[]> {
  const all: OfficialWorld[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await fetch(`${OFFICIAL_API_ROOT}/worlds:by-tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag: OFFICIAL_TAG,
        page_size: LIST_PAGE_SIZE,
        ...(pageToken ? { page_token: pageToken } : {}),
      }),
    });
    const json = (await res.json()) as {
      worlds?: OfficialWorld[];
      next_page_token?: string | null;
      detail?: string;
    };
    if (!res.ok) {
      throw new Error(json.detail ?? `worlds:by-tag HTTP ${res.status}`);
    }
    all.push(...(json.worlds ?? []));
    pageToken = json.next_page_token?.trim() || null;
    if (!pageToken) break;
  }

  return all;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `[sync] fetching official worlds tag=${OFFICIAL_TAG} pageSize=${LIST_PAGE_SIZE} maxPages=${MAX_PAGES}…`,
  );
  const worlds = await listOfficialWorlds();
  if (worlds.length === 0) {
    console.error("[sync-quick-replica-world-gallery] worlds:by-tag returned empty");
    process.exit(1);
  }

  const urlMap: Record<string, string> = {};
  const templates: QrTemplateJson[] = [];
  let ok = 0;

  for (let i = 0; i < worlds.length; i += 1) {
    const listed = worlds[i]!;
    const detail = await fetchOfficialWorldDetail(listed.id);
    const world: OfficialWorld = detail
      ? {
          ...listed,
          ...detail,
          id: listed.id,
          generation_output: {
            ...(listed.generation_output ?? {}),
            ...(detail.generation_output ?? {}),
            spz_urls: {
              ...(listed.generation_output?.spz_urls ?? {}),
              ...(detail.generation_output?.spz_urls ?? {}),
            },
          },
        }
      : listed;

    const id = `qr-world-api-${world.id}`;
    const sortOrder = 100 + i;
    const sourceThumb = extractThumbnailUrl(world);
    const spzKeys = Object.keys(world.generation_output?.spz_urls ?? {});
    if (!spzKeys.includes("full_res")) {
      console.warn(`[warn] ${id} missing full_res · keys=${spzKeys.join(",") || "none"}`);
    }

    if (!sourceThumb) {
      console.warn(`[skip] ${id} no thumbnail`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${id} ← ${sourceThumb}`);
      templates.push(buildTemplate(world, sourceThumb, sourceThumb, sortOrder));
      ok += 1;
      continue;
    }

    try {
      const { buf, contentType, ext } = await fetchImageBuffer(sourceThumb);
      const meta = await sharp(buf).metadata();
      const thumbMeta =
        meta.width && meta.height
          ? { width: meta.width, height: meta.height }
          : undefined;
      const ossUrl = await uploadQuickReplicaBuiltinPreview({
        id,
        buf,
        contentType,
        ext,
      });
      urlMap[id] = ossUrl;
      templates.push(buildTemplate(world, ossUrl, sourceThumb, sortOrder, thumbMeta));
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
    `[sync-quick-replica-world-gallery] done · official=${worlds.length} saved=${templates.length} → ${OUT_JSON}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
