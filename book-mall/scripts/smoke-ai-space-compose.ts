/* eslint-disable no-console */
/**
 * 「我的 AI 空间」合成链路真实冒烟：CosyVoice TTS → wan2.2-s2v 口播 → 画中画合成。
 *
 *   cd book-mall && pnpm gateway:smoke-ai-space -- <bookUserEmail>
 *
 * 会产生 **真实厂商费用**（480P 约 0.5 元/秒 + TTS 约 1 元/万字符），仅用于上线前验证。
 * 素材缺失时自动补：形象取模特库首图，背景取该用户图生视频库最近一条。
 */
import { createAiSpaceComposeTask, getAiSpaceComposeTask } from "../lib/ai-space/ai-space-compose-service";
import {
  assertDigitalHumanImageSize,
  createAiSpaceDigitalHuman,
  listAiSpaceDigitalHumans,
} from "../lib/ai-space/ai-space-digital-human-service";
import { generateAiSpaceTtsAudio } from "../lib/ai-space/ai-space-tts-service";
import {
  createAiSpaceVideoMaterial,
  listAiSpaceVideoMaterials,
} from "../lib/ai-space/ai-space-video-material-service";
import { prisma } from "../lib/prisma";

const TEXT = "大家好，这里是我的 AI 空间数字人口播，第一条测试视频。";
const POLL_MS = 5_000;
const TIMEOUT_MS = 25 * 60 * 1000;

async function downloadBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`下载失败 HTTP ${r.status}: ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function resolveDigitalHumanId(userId: string): Promise<string> {
  const existing = await listAiSpaceDigitalHumans(userId, { activeOnly: true });
  if (existing[0]) {
    console.log(`[素材] 复用形象 ${existing[0].name}`);
    return existing[0].id;
  }

  const model = await prisma.ecomModelLibraryEntry.findFirst({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { name: true, ossUrl: true },
  });
  if (!model) throw new Error("无可用形象：数字人库为空且模特库无记录");

  const buf = await downloadBuffer(model.ossUrl);
  const size = await assertDigitalHumanImageSize(buf);
  const created = await createAiSpaceDigitalHuman({
    userId,
    name: `冒烟测试 · ${model.name}`,
    avatarImageUrl: model.ossUrl,
    width: size.width,
    height: size.height,
  });
  console.log(`[素材] 新建形象 ${created.name}（${size.width}×${size.height}）`);
  return created.id;
}

async function resolveBackgroundId(userId: string): Promise<string | null> {
  const owned = await listAiSpaceVideoMaterials(userId);
  if (owned[0]) {
    console.log(`[素材] 复用背景 ${owned[0].name}`);
    return owned[0].id;
  }

  const clip = await prisma.imageToVideoLibraryItem.findFirst({
    where: { userId, videoUrl: { startsWith: "https://" } },
    orderBy: { createdAt: "desc" },
    select: { videoUrl: true, durationSec: true, modelLabel: true },
  });
  if (!clip) {
    console.warn("[素材] 无可用背景视频，本次只测口播 + 字幕（不测 overlay）");
    return null;
  }

  const created = await createAiSpaceVideoMaterial({
    userId,
    name: `冒烟测试背景 · ${clip.modelLabel ?? "图生视频"}`,
    category: "lifestyle",
    videoUrl: clip.videoUrl,
    durationSec: clip.durationSec ?? 0,
    sourceKind: "upload",
  });
  console.log(`[素材] 新建背景 ${created.name}`);
  return created.id;
}

async function main() {
  // pnpm 会把分隔符 `--` 一并透传，取第一个真实参数
  const email = process.argv.slice(2).find((a) => a.trim() && a !== "--")?.trim();
  if (!email) {
    console.error("用法：pnpm gateway:smoke-ai-space -- <bookUserEmail>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`未找到用户 ${email}`);
  console.log(`[账号] ${user.email} (${user.id})`);

  console.log("\n[1/3] CosyVoice 合成口播音频…");
  const audio = await generateAiSpaceTtsAudio({
    userId: user.id,
    modelKey: "cosyvoice-v3-flash",
    voice: "longanyang",
    text: TEXT,
    name: "冒烟测试口播",
  });
  console.log(
    `      ok · ${audio.durationSec.toFixed(1)}s · ${audio.audioUrl.slice(0, 80)}…`,
  );

  console.log("\n[2/3] 准备形象与背景…");
  const digitalHumanId = await resolveDigitalHumanId(user.id);
  const videoMaterialId = await resolveBackgroundId(user.id);

  console.log("\n[3/3] 发起合成（wan2.2-s2v → 画中画）…");
  const task = await createAiSpaceComposeTask({
    userId: user.id,
    digitalHumanId,
    audioAssetId: audio.id,
    videoMaterialId,
    options: { scale: 0.35, position: "bottom-right", burnSubtitle: true, resolution: "480P" },
  });
  console.log(`      任务 ${task.id}`);

  const deadline = Date.now() + TIMEOUT_MS;
  let lastStatus = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const cur = await getAiSpaceComposeTask(user.id, task.id);
    if (!cur) throw new Error("任务丢失");
    if (cur.status !== lastStatus) {
      lastStatus = cur.status;
      console.log(`      [${new Date().toLocaleTimeString("zh-CN")}] ${cur.statusLabel}`);
    }
    if (cur.status === "completed") {
      console.log(`\n✅ 合成成功：${cur.finalVideoUrl}`);
      console.log(`   口播中间产物：${cur.tempHumanVideoUrl}`);
      return;
    }
    if (cur.status === "failed") {
      console.error(`\n❌ 失败：${cur.errorMessage}`);
      if (cur.gatewayLogId) console.error(`   Gateway 日志：${cur.gatewayLogId}`);
      process.exit(1);
    }
  }
  console.error("\n❌ 超时未完成");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
