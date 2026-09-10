/* eslint-disable no-console */
/**
 * 上传文生试衣内置示例图到平台 OSS 固定 key（ecom/text-tryon-demo/*）。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-vton-text-tryon-demo-assets.ts
 *
 * 可选：--source-garment=<https url> --source-glasses=<https url>
 */
import { uploadEcomTextTryonDemoAsset } from "../lib/canvas/canvas-oss";
import {
  resolveEcomVtonTextTryonDemoOssUrl,
  VTON_TEXT_TRYON_DEMO_SLOTS,
} from "../lib/ecom/ecom-vton-text-tryon-demo";

const DEFAULT_SOURCES: Record<(typeof VTON_TEXT_TRYON_DEMO_SLOTS)[number]["slot"], string> = {
  garment:
    "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/user-upload/cmplfp85q0000r03ut03lft88/2da5d726-b45b-479b-aadf-dc9f5157e19a.png",
  "accessory-glasses":
    "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/user-upload/cmplfp85q0000r03ut03lft88/defca0f6-92dd-4bb7-bebd-e9f64a39eb65.png",
};

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function download(url: string): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`);
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType, ext };
}

async function main() {
  for (const { slot, label } of VTON_TEXT_TRYON_DEMO_SLOTS) {
    const argKey = slot === "garment" ? "source-garment" : "source-glasses";
    const sourceUrl = parseArg(argKey) ?? DEFAULT_SOURCES[slot];
    console.log(`[seed] ${label} ← ${sourceUrl}`);
    const { buf, contentType, ext } = await download(sourceUrl);
    const ossUrl = await uploadEcomTextTryonDemoAsset({ slot, buf, contentType, ext });
    console.log(`  → ${ossUrl}`);
    console.log(`  canonical ${resolveEcomVtonTextTryonDemoOssUrl(slot)}`);
  }
  console.log("[seed] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
