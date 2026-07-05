/* eslint-disable no-console */
/**
 * 将内置场景 gallery 中的 World Labs splat（100k / full_res 等）下载并上传 OSS，
 * 更新 builtin-world-gallery.json 中的 splat_urls 为 OSS 公网 URL。
 *
 * 环境：book-mall/.env.local → OSS_* / OSS_PUBLIC_URL_BASE
 *
 * 使用：
 *   cd book-mall && pnpm qr:sync-world-splats
 *   pnpm qr:sync-world-splats --dry-run
 *   pnpm qr:sync-world-splats --force
 *   pnpm qr:sync-world-splats --world-id=6425f0fd-fed4-4569-9d92-1ea90f5627d0
 *   pnpm qr:sync-world-splats --all-tiers
 *
 * 建议先单场景试跑：--world-id=6425f0fd-fed4-4569-9d92-1ea90f5627d0
 * full_res 约 30MB/场景，48 场景全量需数小时，中断后可重跑（已 OSS 的档位会自动 skip）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { uploadQuickReplicaBuiltinSplat } from "../lib/canvas/canvas-oss";
import type { QrTemplateJson } from "../lib/quick-replica/qr-types";

const ROOT = resolve(__dirname, "..");
const GALLERY_JSON = resolve(ROOT, "content", "quick-replica", "builtin-world-gallery.json");
const SPLAT_SOURCES_JSON = resolve(
  ROOT,
  "content",
  "quick-replica",
  "builtin-world-gallery.splat-sources.json",
);

const DEFAULT_TIERS = ["100k", "full_res"] as const;
const ALL_TIERS = ["100k", "150k", "500k", "full_res"] as const;

type SplatSourceMap = Record<string, Record<string, string>>;

function parseArgValue(prefix: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit ? hit.slice(prefix.length + 1).trim() : null;
}

function isOssQuickReplicaUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes("aliyuncs.com/quick-replica/");
}

function isVendorSplatUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes("worldlabs.ai") || u.includes("googleapis.com") || u.includes("googleusercontent.com");
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function loadGallery(): QrTemplateJson[] {
  return JSON.parse(readFileSync(GALLERY_JSON, "utf8")) as QrTemplateJson[];
}

function loadSplatSources(): SplatSourceMap {
  try {
    return JSON.parse(readFileSync(SPLAT_SOURCES_JSON, "utf8")) as SplatSourceMap;
  } catch {
    return {};
  }
}

function writeSplatSources(map: SplatSourceMap): void {
  writeFileSync(SPLAT_SOURCES_JSON, JSON.stringify(map, null, 2) + "\n");
}

function getWorldId(template: QrTemplateJson): string | null {
  const params = template.reference?.model?.params as Record<string, unknown> | undefined;
  const worldId = params?.world_id;
  return typeof worldId === "string" && worldId.trim() ? worldId.trim() : null;
}

function getSplatUrls(template: QrTemplateJson): Record<string, string> {
  const params = template.reference?.model?.params as Record<string, unknown> | undefined;
  const raw = params?.splat_urls;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function getSplatSourceUrls(template: QrTemplateJson): Record<string, string> {
  const params = template.reference?.model?.params as Record<string, unknown> | undefined;
  const raw = params?.splat_source_urls;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function setSplatParams(
  template: QrTemplateJson,
  splatUrls: Record<string, string>,
  splatSourceUrls: Record<string, string>,
): void {
  const model = template.reference?.model;
  if (!model) return;
  const params = (model.params ?? {}) as Record<string, unknown>;
  params.splat_urls = splatUrls;
  params.splat_source_urls = splatSourceUrls;
  model.params = params;
}

async function fetchSplatBuffer(
  url: string,
  label: string,
  retries = 3,
): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const started = Date.now();
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const lenHeader = res.headers.get("content-length");
      const expected = lenHeader ? Number.parseInt(lenHeader, 10) : null;
      const buf = Buffer.from(await res.arrayBuffer());
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      const speed =
        buf.length > 0 && Number(elapsed) > 0
          ? formatBytes(buf.length / Number(elapsed)) + "/s"
          : "?";
      console.log(
        `  [download] ${label} ${formatBytes(buf.length)}${expected ? ` / ${formatBytes(expected)}` : ""} · ${elapsed}s · ${speed}`,
      );
      return buf;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        console.warn(`  [retry] ${label} attempt ${attempt}/${retries}`);
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw lastError;
}

function resolveDownloadUrl(args: {
  tier: string;
  currentUrl: string | undefined;
  sourceUrls: Record<string, string>;
  sidecarSources: Record<string, string> | undefined;
  force: boolean;
}): string | null {
  const { tier, currentUrl, sourceUrls, sidecarSources, force } = args;
  if (currentUrl && isVendorSplatUrl(currentUrl)) return currentUrl;
  const fromParams = sourceUrls[tier];
  if (fromParams && isVendorSplatUrl(fromParams)) return fromParams;
  const fromSidecar = sidecarSources?.[tier];
  if (fromSidecar && isVendorSplatUrl(fromSidecar)) return fromSidecar;
  if (force && currentUrl && !isOssQuickReplicaUrl(currentUrl)) return currentUrl;
  return null;
}

function syncBuiltinThumbSourceUrl(template: QrTemplateJson): boolean {
  const thumb = template.thumbnailUrl?.trim();
  if (!thumb || !isOssQuickReplicaUrl(thumb)) return false;
  const model = template.reference?.model;
  if (!model) return false;
  const params = (model.params ?? {}) as Record<string, unknown>;
  const current =
    typeof params.thumbnail_source_url === "string" ? params.thumbnail_source_url.trim() : "";
  if (current === thumb) return false;
  params.thumbnail_source_url = thumb;
  model.params = params;
  return true;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const allTiers = process.argv.includes("--all-tiers");
  const filterWorldId = parseArgValue("--world-id");
  const tiersArg = parseArgValue("--tiers");
  const tiers = tiersArg
    ? tiersArg.split(",").map((s) => s.trim()).filter(Boolean)
    : allTiers
      ? [...ALL_TIERS]
      : [...DEFAULT_TIERS];

  const templates = loadGallery();
  const splatSources = loadSplatSources();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `[sync-world-splats] templates=${templates.length} tiers=${tiers.join(",")} dryRun=${dryRun} force=${force}`,
  );

  const persist = () => {
    writeFileSync(GALLERY_JSON, JSON.stringify(templates, null, 2) + "\n");
    writeSplatSources(splatSources);
  };

  for (const template of templates) {
    const worldId = getWorldId(template);
    if (!worldId) continue;
    if (filterWorldId && worldId !== filterWorldId) continue;

    const templateId = template.id;
    const splatUrls = getSplatUrls(template);
    const sourceUrls = getSplatSourceUrls(template);
    const sidecar = splatSources[templateId] ?? {};
    let changed = false;

    console.log(`\n[world] ${templateId} (${template.title ?? worldId})`);

    for (const tier of tiers) {
      const currentUrl = splatUrls[tier];
      if (!currentUrl && !sourceUrls[tier] && !sidecar[tier]) {
        console.log(`  [skip] ${tier} · no url`);
        continue;
      }

      if (!force && currentUrl && isOssQuickReplicaUrl(currentUrl)) {
        console.log(`  [skip] ${tier} · already OSS`);
        skipped += 1;
        continue;
      }

      const downloadUrl = resolveDownloadUrl({
        tier,
        currentUrl,
        sourceUrls,
        sidecarSources: sidecar,
        force,
      });

      if (!downloadUrl) {
        console.warn(`  [skip] ${tier} · no vendor source url`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`  [dry-run] ${tier} ← ${downloadUrl}`);
        splatUrls[tier] = `https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/builtin/splats/${templateId}-${tier}.spz`;
        sourceUrls[tier] = downloadUrl;
        sidecar[tier] = downloadUrl;
        changed = true;
        uploaded += 1;
        continue;
      }

      try {
        const buf = await fetchSplatBuffer(downloadUrl, tier);
        const ossUrl = await uploadQuickReplicaBuiltinSplat({
          templateId,
          tier,
          buf,
        });
        console.log(`  [ok] ${tier} → ${ossUrl}`);
        splatUrls[tier] = ossUrl;
        sourceUrls[tier] = downloadUrl;
        sidecar[tier] = downloadUrl;
        changed = true;
        uploaded += 1;
      } catch (e) {
        console.error(`  [fail] ${tier}`, e);
        failed += 1;
      }
    }

    if (changed) {
      setSplatParams(template, splatUrls, sourceUrls);
      splatSources[templateId] = { ...sidecar, ...sourceUrls };
      if (!dryRun) persist();
    }
  }

  if (dryRun) {
    console.log(`\n[dry-run] would update ${uploaded} tier(s), skip ${skipped}, fail ${failed}`);
    return;
  }

  let thumbSourceFixed = 0;
  for (const template of templates) {
    if (syncBuiltinThumbSourceUrl(template)) thumbSourceFixed += 1;
  }
  if (thumbSourceFixed > 0) {
    persist();
    console.log(`[sync-world-splats] thumbnail_source_url → OSS · ${thumbSourceFixed} templates`);
  }

  console.log(
    `\n[sync-world-splats] done · uploaded=${uploaded} skipped=${skipped} failed=${failed} → ${GALLERY_JSON}`,
  );

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
