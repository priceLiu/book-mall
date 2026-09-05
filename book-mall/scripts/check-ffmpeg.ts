/**
 * 检查 book-mall 进程能否调用 ffmpeg（与自动剪辑相同环境）。
 *
 *   pnpm media-render:check-ffmpeg
 */
import {
  ffmpegOperatorHint,
  isFfmpegAvailable,
} from "../lib/media/ffmpeg-preflight";
import { resolveSubtitleBurnInFont } from "../lib/media/subtitle-ffmpeg-style";

async function main() {
  const ok = await isFfmpegAvailable(true);
  if (ok) {
    try {
      const font = resolveSubtitleBurnInFont();
      console.log(
        `[ffmpeg] OK — 云端自动剪辑可用；字幕字体 ${font.fontName} (${font.fontFile})`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[ffmpeg] OK — 自动剪辑可用，但烧录中文字幕会出方框");
      console.log(`[ffmpeg] ${msg}`);
    }
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
