/**
 * 存量画布视频回填：faststart（边下边播）+ 首帧封面 poster。
 *
 * 背景：旧视频原样落 OSS，vendor 的 mp4 常把 moov atom 放尾部 → 浏览器要下大半文件才能播；
 *       且早期未生成首帧封面。本脚本对已成功的画布视频任务：
 *   1) faststart：把 moov 移到文件头，**覆盖写回同一个 OSS key**（URL 不变，无需改 DB）。
 *   2) poster：缺封面时截首帧 JPEG 上传，并写回 CanvasGenerationTask.resultPayload.posterUrl
 *      （前端 task-pick 会读取它 → 节点即显示封面）。
 *
 * 幂等：faststart 已在头部则跳过；poster 已存在则跳过。可重复运行。
 * 依赖：ffmpeg（与 poster/faststart 在线路径相同）。
 *
 *   # 仅扫描、列出将要处理的项（默认 dry-run，不改任何东西）
 *   pnpm canvas:backfill-video -- --dry-run
 *
 *   # 实际回填（会覆盖 OSS 视频对象 + 写 DB resultPayload）
 *   pnpm canvas:backfill-video -- --apply
 *
 *   # 仅某项目 / 仅其一阶段 / 限制条数
 *   pnpm canvas:backfill-video -- --apply --project <projectId>
 *   pnpm canvas:backfill-video -- --apply --faststart-only
 *   pnpm canvas:backfill-video -- --apply --poster-only --limit 100
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  createOssClientFrom,
  ossUploadBuffer,
  readOssEnv,
} from "../lib/oss-client";
import {
  extractVideoFirstFrameJpeg,
  mergeResultPayloadPoster,
  remuxMp4Faststart,
} from "../lib/canvas/video-poster-ffmpeg";
import { buildCanvasOssKey } from "../lib/canvas/canvas-constants";

const MULTIPART_THRESHOLD = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 600_000;

type Args = {
  dryRun: boolean;
  projectId?: string;
  limit: number;
  faststartOnly: boolean;
  posterOnly: boolean;
};

function parseArgs(argv: string[]): Args {
  let dryRun = true;
  let projectId: string | undefined;
  let limit = 500;
  let faststartOnly = false;
  let posterOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") dryRun = false;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--faststart-only") faststartOnly = true;
    else if (arg === "--poster-only") posterOnly = true;
    else if (arg.startsWith("--project=")) projectId = arg.slice("--project=".length);
    else if (arg === "--project") {
      projectId = argv[i + 1]?.trim() || undefined;
      if (projectId) i += 1;
    } else if (arg.startsWith("--limit=")) {
      limit = Number(arg.slice("--limit=".length)) || limit;
    } else if (arg === "--limit") {
      limit = Number(argv[i + 1]) || limit;
      i += 1;
    }
  }
  return { dryRun, projectId, limit, faststartOnly, posterOnly };
}

function ossUrlToKey(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

function readPosterUrl(resultPayload: unknown): string | null {
  if (!resultPayload || typeof resultPayload !== "object") return null;
  const v = (resultPayload as { posterUrl?: unknown }).posterUrl;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * 用首段字节判断 mp4 是否已 faststart（moov 在 mdat 之前）。
 * 返回 true=需要重排；false=已在头部；null=无法判断（按需要处理）。
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function probeNeedsFaststart(url: string): Promise<boolean | null> {
  try {
    const r = await fetchWithTimeout(
      url,
      { headers: { Range: "bytes=0-65535" } },
      15_000,
    );
    if (!r.ok && r.status !== 206) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    let off = 0;
    while (off + 8 <= buf.byteLength) {
      let size = buf.readUInt32BE(off);
      const type = buf.toString("ascii", off + 4, off + 8);
      let headerLen = 8;
      if (size === 1) {
        if (off + 16 > buf.byteLength) break;
        // 64-bit size：低 32 位足够判断推进
        size = Number(buf.readBigUInt64BE(off + 8));
        headerLen = 16;
      }
      if (type === "moov") return false; // moov 在前 → 已 faststart
      if (type === "mdat") return true; // 先遇到 mdat → moov 在后，需要重排
      if (size <= 0) break; // size=0 表示到 EOF（mdat 常见），无法继续
      off += size < headerLen ? headerLen : size;
    }
    return null;
  } catch {
    return null;
  }
}

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const r = await fetchWithTimeout(url, {}, 120_000);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = readOssEnv();
  if ("error" in cfg) {
    console.error("[backfill-video] OSS 未配置：", cfg.error);
    process.exit(1);
  }

  const doFaststart = !args.posterOnly;
  const doPoster = !args.faststartOnly;

  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "SUCCEEDED",
      deletedAt: null,
      ossUrl: { contains: "node-video" },
      ...(args.projectId ? { projectId: args.projectId } : {}),
    },
    select: { id: true, projectId: true, ossUrl: true, resultPayload: true },
    orderBy: { completedAt: "desc" },
    take: args.limit,
  });

  console.log(
    `[backfill-video] scan tasks=${tasks.length} dryRun=${args.dryRun} faststart=${doFaststart} poster=${doPoster}`,
  );

  let fastDone = 0;
  let fastSkip = 0;
  let posterDone = 0;
  let posterSkip = 0;
  let failed = 0;

  for (const task of tasks) {
    const url = task.ossUrl?.trim();
    if (!url) continue;
    const key = ossUrlToKey(url);
    if (!key) {
      console.warn(`[skip] task=${task.id} 无法解析 OSS key from ${url}`);
      continue;
    }

    const hasPoster = Boolean(readPosterUrl(task.resultPayload));
    const needPoster = doPoster && !hasPoster;
    const needFaststartProbe = doFaststart
      ? await probeNeedsFaststart(url)
      : false;
    const needFaststart = doFaststart && needFaststartProbe !== false; // null/true 都处理

    if (!needPoster && !needFaststart) {
      if (doFaststart) fastSkip += 1;
      if (doPoster) posterSkip += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(
        `[dry-run] task=${task.id} project=${task.projectId} faststart=${needFaststart} poster=${needPoster} key=${key}`,
      );
      if (needFaststart) fastDone += 1;
      if (needPoster) posterDone += 1;
      continue;
    }

    // 实际处理：下载一次原始视频，兼顾 faststart 与封面
    const buf = await downloadBuffer(url);
    if (!buf || !buf.byteLength) {
      console.warn(`[fail] task=${task.id} 下载失败 ${url}`);
      failed += 1;
      continue;
    }

    // 1) faststart：覆盖写回同一 key（URL 不变）
    if (needFaststart) {
      const fast = await remuxMp4Faststart(buf, "mp4");
      if (fast && fast.byteLength) {
        try {
          const client = await createOssClientFrom(cfg, {
            timeoutMs: UPLOAD_TIMEOUT_MS,
          });
          await ossUploadBuffer(client, {
            key,
            buf: fast,
            contentType: "video/mp4",
            useMultipart: fast.byteLength >= MULTIPART_THRESHOLD,
            timeoutMs: UPLOAD_TIMEOUT_MS,
          });
          fastDone += 1;
          console.log(`[faststart] task=${task.id} key=${key} (${fast.byteLength}B)`);
        } catch (e) {
          failed += 1;
          console.warn(`[fail] faststart task=${task.id}`, e);
        }
      } else {
        fastSkip += 1; // ffmpeg 不可用 / 非 mp4 → 保持原样
      }
    } else if (doFaststart) {
      fastSkip += 1;
    }

    // 2) poster：缺封面才生成
    if (needPoster) {
      const jpeg = await extractVideoFirstFrameJpeg(buf);
      if (jpeg && jpeg.byteLength) {
        try {
          const posterKey = buildCanvasOssKey("node-image", {
            projectId: task.projectId,
            ext: "jpg",
          });
          const client = await createOssClientFrom(cfg, { timeoutMs: 60_000 });
          const put = await ossUploadBuffer(client, {
            key: posterKey,
            buf: jpeg,
            contentType: "image/jpeg",
            useMultipart: false,
            timeoutMs: 60_000,
          });
          const posterUrl =
            typeof put.url === "string" && /^https:\/\//i.test(put.url)
              ? put.url
              : `${(process.env.OSS_PUBLIC_URL_BASE || "").replace(/\/$/, "")}/${posterKey}`;
          await prisma.canvasGenerationTask.update({
            where: { id: task.id },
            data: {
              resultPayload: mergeResultPayloadPoster(
                task.resultPayload,
                posterUrl,
              ) as Prisma.InputJsonValue,
            },
          });
          posterDone += 1;
          console.log(`[poster] task=${task.id} -> ${posterUrl}`);
        } catch (e) {
          failed += 1;
          console.warn(`[fail] poster task=${task.id}`, e);
        }
      } else {
        posterSkip += 1; // ffmpeg 不可用 → 跳过
      }
    } else if (doPoster) {
      posterSkip += 1;
    }
  }

  console.log(
    `[backfill-video] done faststart(done=${fastDone} skip=${fastSkip}) poster(done=${posterDone} skip=${posterSkip}) failed=${failed}`,
  );
  if (args.dryRun) {
    console.log("[dry-run] 重新带 --apply 执行实际回填（会覆盖 OSS 视频对象 + 写 DB）");
  }
}

main()
  .catch((e) => {
    console.error("[backfill-canvas-video-faststart-poster] error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
