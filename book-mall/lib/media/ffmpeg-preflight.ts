import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** 面向终端用户（画布/电商 UI） */
export const FFMPEG_USER_MESSAGE =
  "云端自动剪辑服务暂未就绪，请稍后再试；若持续出现请联系客服。";

let cachedAvailable: boolean | null = null;

export async function isFfmpegAvailable(force = false): Promise<boolean> {
  if (!force && cachedAvailable !== null) return cachedAvailable;
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 8000 });
    await execFileAsync("ffprobe", ["-version"], { timeout: 8000 });
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

export function ffmpegOperatorHint(): string {
  if (process.platform === "darwin") {
    return "本地开发：在 book-mall 目录执行 pnpm media-render:setup-ffmpeg（或 brew install ffmpeg）后重启 dev:all";
  }
  if (process.platform === "linux") {
    return "服务器：apt-get install -y ffmpeg（book-mall Docker 镜像已内置）";
  }
  return "请在本机 PATH 安装 ffmpeg 与 ffprobe：https://ffmpeg.org/download.html";
}

export class MediaRenderUnavailableError extends Error {
  readonly code = "FFMPEG_UNAVAILABLE" as const;
  readonly userMessage = FFMPEG_USER_MESSAGE;
  readonly operatorHint: string;

  constructor(operatorHint = ffmpegOperatorHint()) {
    super(FFMPEG_USER_MESSAGE);
    this.name = "MediaRenderUnavailableError";
    this.operatorHint = operatorHint;
  }
}

/** 提交剪辑任务前调用；缺 ffmpeg 时抛 MediaRenderUnavailableError */
export async function assertFfmpegForMediaRender(): Promise<void> {
  if (await isFfmpegAvailable()) return;
  console.error("[media-render] ffmpeg/ffprobe 不可用 —", ffmpegOperatorHint());
  throw new MediaRenderUnavailableError();
}
