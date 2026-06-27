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
 *   pnpm canvas:backfill-video -- --apply --limit 50 --offset 150   # 分页扫存量
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  createOssClientFrom,
  ossGetBuffer,
  ossUploadBuffer,
  readOssEnv,
  withOssRetry,
} from "../lib/oss-client";
import {
  extractVideoFirstFrameJpeg,
  mergeResultPayloadPoster,
  remuxMp4Faststart,
} from "../lib/canvas/video-poster-ffmpeg";
import { buildCanvasOssKey } from "../lib/canvas/canvas-constants";

const MULTIPART_THRESHOLD = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 600_000;
/** 大文件分片并发；1 最稳，2 折中 */
const MULTIPART_PARALLEL = (() => {
  const n = Number(process.env.BACKFILL_OSS_PARALLEL ?? "2");
  return Number.isFinite(n) && n >= 1 ? Math.min(4, Math.floor(n)) : 2;
})();

type OssClient = Awaited<ReturnType<typeof createOssClientFrom>>;

type Args = {
  dryRun: boolean;
  projectId?: string;
  limit: number;
  offset: number;
  faststartOnly: boolean;
  posterOnly: boolean;
};

function parseArgs(argv: string[]): Args {
  let dryRun = true;
  let projectId: string | undefined;
  let limit = 500;
  let offset = 0;
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
    } else if (arg.startsWith("--offset=")) {
      offset = Number(arg.slice("--offset=".length)) || offset;
    } else if (arg === "--offset") {
      offset = Number(argv[i + 1]) || offset;
      i += 1;
    }
  }
  return { dryRun, projectId, limit, offset, faststartOnly, posterOnly };
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
function probeMp4NeedsFaststart(buf: Buffer): boolean | null {
  let off = 0;
  while (off + 8 <= buf.byteLength) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    let headerLen = 8;
    if (size === 1) {
      if (off + 16 > buf.byteLength) break;
      size = Number(buf.readBigUInt64BE(off + 8));
      headerLen = 16;
    }
    if (type === "moov") return false;
    if (type === "mdat") return true;
    if (size <= 0) break;
    off += size < headerLen ? headerLen : size;
  }
  return null;
}

async function probeNeedsFaststart(
  client: OssClient,
  key: string,
): Promise<boolean | null> {
  try {
    const buf = await withOssRetry(
      `[probe ${key.slice(-24)}]`,
      () => ossGetBuffer(client, { key, range: "bytes=0-65535", timeoutMs: 30_000 }),
      { attempts: 3 },
    );
    if (!buf) return null;
    return probeMp4NeedsFaststart(buf);
  } catch {
    return null;
  }
}

async function downloadFromOss(client: OssClient, key: string): Promise<Buffer | null> {
  try {
    return await withOssRetry(
      `[get ${key.slice(-24)}]`,
      () => ossGetBuffer(client, { key, timeoutMs: UPLOAD_TIMEOUT_MS }),
      { attempts: 4 },
    );
  } catch {
    return null;
  }
}

async function uploadToOss(
  client: OssClient,
  args: {
    key: string;
    buf: Buffer;
    contentType: string;
  },
): Promise<void> {
  await withOssRetry(
    `[put ${args.key.slice(-24)}]`,
    () =>
      ossUploadBuffer(client, {
        key: args.key,
        buf: args.buf,
        contentType: args.contentType,
        useMultipart: args.buf.byteLength >= MULTIPART_THRESHOLD,
        timeoutMs: UPLOAD_TIMEOUT_MS,
        multipartParallel: MULTIPART_PARALLEL,
      }),
    { attempts: 4 },
  );
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

  const ossClient = await createOssClientFrom(cfg, { timeoutMs: UPLOAD_TIMEOUT_MS });
  const transport =
    cfg.endpoint?.trim() ||
    `https://${cfg.bucket}.${cfg.region}.aliyuncs.com (SDK 默认)`;
  console.log(
    `[backfill-video] OSS transport=${transport} multipartParallel=${MULTIPART_PARALLEL}`,
  );

  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "SUCCEEDED",
      deletedAt: null,
      ossUrl: { contains: "node-video" },
      ...(args.projectId ? { projectId: args.projectId } : {}),
    },
    select: { id: true, projectId: true, ossUrl: true, resultPayload: true },
    orderBy: { completedAt: "desc" },
    skip: args.offset,
    take: args.limit,
  });

  console.log(
    `[backfill-video] scan tasks=${tasks.length} offset=${args.offset} dryRun=${args.dryRun} faststart=${doFaststart} poster=${doPoster}`,
  );

  let fastDone = 0;
  let fastSkip = 0;
  let posterDone = 0;
  let posterSkip = 0;
  let failed = 0;
  const total = tasks.length;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const progress = `[${i + 1}/${total}]`;
    const url = task.ossUrl?.trim();
    if (!url) continue;
    const key = ossUrlToKey(url);
    if (!key) {
      console.warn(`${progress} skip task=${task.id} 无法解析 OSS key`);
      continue;
    }

    const hasPoster = Boolean(readPosterUrl(task.resultPayload));
    const needPoster = doPoster && !hasPoster;
    if (doFaststart || needPoster) {
      console.log(`${progress} task=${task.id.slice(0, 12)}… probing`);
    }
    const needFaststartProbe = doFaststart
      ? await probeNeedsFaststart(ossClient, key)
      : false;
    const needFaststart = doFaststart && needFaststartProbe !== false; // null/true 都处理

    if (!needPoster && !needFaststart) {
      console.log(`${progress} task=${task.id.slice(0, 12)}… skip (已满足)`);
      if (doFaststart) fastSkip += 1;
      if (doPoster) posterSkip += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(
        `${progress} [dry-run] task=${task.id} faststart=${needFaststart} poster=${needPoster}`,
      );
      if (needFaststart) fastDone += 1;
      if (needPoster) posterDone += 1;
      continue;
    }

    console.log(
      `${progress} task=${task.id.slice(0, 12)}… oss get (${[
        needFaststart && "faststart",
        needPoster && "poster",
      ]
        .filter(Boolean)
        .join("+")})`,
    );
    const buf = await downloadFromOss(ossClient, key);
    if (!buf || !buf.byteLength) {
      console.warn(`${progress} fail task=${task.id} OSS 下载失败`);
      failed += 1;
      continue;
    }
    console.log(`${progress} oss get ok ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`);

    // 1) faststart：覆盖写回同一 key（URL 不变）
    if (needFaststart) {
      console.log(`${progress} remux faststart…`);
      const fast = await remuxMp4Faststart(buf, "mp4");
      if (fast && fast.byteLength) {
        try {
          console.log(`${progress} oss put faststart…`);
          await uploadToOss(ossClient, {
            key,
            buf: fast,
            contentType: "video/mp4",
          });
          fastDone += 1;
          console.log(`${progress} faststart ok (${(fast.byteLength / 1024 / 1024).toFixed(1)}MB)`);
        } catch (e) {
          failed += 1;
          console.warn(`${progress} fail faststart task=${task.id}`, e);
        }
      } else {
        fastSkip += 1;
        console.log(`${progress} faststart skip (ffmpeg 不可用或非 mp4)`);
      }
    } else if (doFaststart) {
      fastSkip += 1;
    }

    // 2) poster：缺封面才生成
    if (needPoster) {
      console.log(`${progress} extracting poster…`);
      const jpeg = await extractVideoFirstFrameJpeg(buf);
      if (jpeg && jpeg.byteLength) {
        try {
          const posterKey = buildCanvasOssKey("node-image", {
            projectId: task.projectId,
            ext: "jpg",
          });
          await uploadToOss(ossClient, {
            key: posterKey,
            buf: jpeg,
            contentType: "image/jpeg",
          });
          const posterUrl =
            `${(process.env.OSS_PUBLIC_URL_BASE || `https://${cfg.bucket}.${cfg.region}.aliyuncs.com`).replace(/\/$/, "")}/${posterKey}`;
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
          console.log(`${progress} poster ok`);
        } catch (e) {
          failed += 1;
          console.warn(`${progress} fail poster task=${task.id}`, e);
        }
      } else {
        posterSkip += 1;
        console.log(`${progress} poster skip (ffmpeg 不可用)`);
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
