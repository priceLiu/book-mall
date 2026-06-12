/**
 * 检查 book-mall 进程能否调用 ffmpeg（与自动剪辑相同环境）。
 *
 *   pnpm media-render:check-ffmpeg
 */
import {
  ffmpegOperatorHint,
  isFfmpegAvailable,
} from "../lib/media/ffmpeg-preflight";

async function main() {
  const ok = await isFfmpegAvailable(true);
  if (ok) {
    console.log("[ffmpeg] OK — 云端自动剪辑可用");
    return;
  }
  console.error("[ffmpeg] 不可用 — 自动剪辑将失败");
  console.error(ffmpegOperatorHint());
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
