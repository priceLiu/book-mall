/* eslint-disable no-console */
/**
 * 只验证 composite 渲染路径（背景循环 + overlay + 音轨 + 字幕），不调用厂商模型。
 *
 *   cd book-mall && pnpm gateway:smoke-composite -- <bookUserEmail>
 *
 * 前景取该用户图生视频库最近一条，背景取次新一条（只有一条时不叠背景），
 * 音轨与字幕取音频库最近一条 TTS。
 */
import { MediaRenderJobStatus } from "@prisma/client";

import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
} from "../lib/media/media-render-service";
import { prisma } from "../lib/prisma";

const POLL_MS = 3_000;
const TIMEOUT_MS = 15 * 60 * 1000;

async function main() {
  const email =
    process.argv.slice(2).find((a) => a.trim() && a !== "--")?.trim() ??
    "13808816802@126.com";
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`未找到用户 ${email}`);

  const candidates = await prisma.imageToVideoLibraryItem.findMany({
    where: { userId: user.id, videoUrl: { startsWith: "https://" } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { videoUrl: true, durationSec: true },
  });
  // 库记录可能指向已被清理的 OSS 对象，先探活再用
  const clips: typeof candidates = [];
  for (const c of candidates) {
    if (clips.length >= 2) break;
    const ok = await fetch(c.videoUrl, { method: "HEAD" })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) clips.push(c);
    else console.warn(`[skip] 链接失效 ${c.videoUrl.slice(-40)}`);
  }
  if (clips.length === 0) throw new Error("该用户图生视频库无可访问视频，无法测试");

  const audio = await prisma.aiSpaceAudioAsset.findFirst({
    where: { userId: user.id, sourceType: "tts" },
    orderBy: { createdAt: "desc" },
    select: { audioUrl: true, textScript: true, durationSec: true },
  });

  const foreground = clips[0]!;
  const background = clips[1] ?? null;
  console.log(`[前景] ${foreground.videoUrl.slice(0, 90)}…`);
  console.log(`[背景] ${background ? background.videoUrl.slice(0, 90) + "…" : "(不叠背景)"}`);
  console.log(`[音轨] ${audio ? `${audio.durationSec.toFixed(1)}s` : "(用前景原声)"}`);

  const job = await createMediaRenderJob({
    userId: user.id,
    sourceApp: "api",
    sourceRef: { smoke: "composite" },
    timeline: {
      version: 1,
      clips: [{ order: 0, videoUrl: foreground.videoUrl }],
      composite: {
        mode: "composite",
        backgroundUrl: background?.videoUrl,
        audioUrl: audio?.audioUrl,
        overlay: { scale: 0.35, position: "bottom-right", marginPx: 20 },
        subtitleText: audio?.textScript ?? undefined,
      },
    },
    profile: {
      transition: { type: "none" },
      subtitle: { mode: "script", burnIn: Boolean(audio?.textScript) },
      video: { scaleMode: "fit720p" },
    },
  });
  console.log(`[任务] ${job.id}`);
  enqueueMediaRenderJob(job.id);

  const deadline = Date.now() + TIMEOUT_MS;
  let lastLabel = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const cur = await prisma.mediaRenderJob
      .findUnique({
        where: { id: job.id },
        select: {
          status: true,
          progress: true,
          progressLabel: true,
          resultOssUrl: true,
          errorMessage: true,
        },
      })
      .catch(() => null);
    if (!cur) continue;
    const label = `${cur.progress}% ${cur.progressLabel ?? ""}`;
    if (label !== lastLabel) {
      lastLabel = label;
      console.log(`      ${label}`);
    }
    if (cur.status === MediaRenderJobStatus.SUCCEEDED) {
      console.log(`\n✅ 合成成功：${cur.resultOssUrl}`);
      return;
    }
    if (cur.status === MediaRenderJobStatus.FAILED) {
      console.error(`\n❌ 合成失败：${cur.errorMessage}`);
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
