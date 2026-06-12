/**
 * 一键安装 ffmpeg（本地开发用；终端用户无需运行）。
 *
 *   cd book-mall && pnpm media-render:setup-ffmpeg
 */
import { execFileSync, execSync } from "child_process";

function has(cmd: string): boolean {
  try {
    execFileSync(cmd, ["-version"], { stdio: "ignore", timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const ffmpegOk = has("ffmpeg");
  const ffprobeOk = has("ffprobe");
  if (ffmpegOk && ffprobeOk) {
    console.log("[ffmpeg] 已就绪（ffmpeg + ffprobe）");
    return;
  }

  if (process.platform === "darwin") {
    if (!has("brew")) {
      console.error(
        "[ffmpeg] 未检测到 Homebrew。请先安装：https://brew.sh 然后执行 brew install ffmpeg",
      );
      process.exit(1);
    }
    console.log("[ffmpeg] 正在通过 Homebrew 安装 ffmpeg（含 ffprobe）…");
    execSync("brew install ffmpeg", { stdio: "inherit" });
    if (has("ffmpeg") && has("ffprobe")) {
      console.log("[ffmpeg] 安装完成。请重启 pnpm dev:all 后再试自动剪辑。");
      return;
    }
    console.error("[ffmpeg] 安装后仍未检测到 ffmpeg，请手动检查 PATH。");
    process.exit(1);
  }

  if (process.platform === "linux") {
    console.log(
      "[ffmpeg] Linux 请由运维在 book-mall 主机或容器内执行：\n" +
        "  sudo apt-get update && sudo apt-get install -y ffmpeg\n" +
        "生产环境请使用已内置 ffmpeg 的 book-mall Docker 镜像。",
    );
    process.exit(ffmpegOk && ffprobeOk ? 0 : 1);
  }

  console.error(
    "[ffmpeg] 请从 https://ffmpeg.org/download.html 安装，并确保 ffmpeg、ffprobe 在 PATH 中。",
  );
  process.exit(1);
}

main();
