import { spawn } from "child_process";

/** 多分镜 xfade + 字幕烧录在容器内可能跑较久 */
const DEFAULT_FFMPEG_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_FFPROBE_TIMEOUT_MS = 120_000;
const STDERR_TAIL_MAX = 64 * 1024;

export type FfmpegExecOptions = {
  timeoutMs?: number;
};

function hasQuietLogging(args: string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-loglevel") return true;
    if (args[i] === "-v" && args[i + 1] === "error") return true;
  }
  return false;
}

/** 减少 stderr 进度刷屏；避免 execFile maxBuffer 溢出 */
function prependQuietGlobalFlags(args: string[]): string[] {
  const prefix: string[] = [];
  if (!args.includes("-hide_banner")) prefix.push("-hide_banner");
  if (!hasQuietLogging(args)) prefix.push("-loglevel", "error", "-nostats");
  return [...prefix, ...args];
}

function runCommand(
  command: string,
  args: string[],
  opts: { timeoutMs: number; captureStdout: boolean },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderrTail = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      if (opts.captureStdout) stdout += chunk.toString("utf8");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-STDERR_TAIL_MAX);
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          `${command} 执行超时（${Math.round(opts.timeoutMs / 60_000)} 分钟）`,
        ),
      );
    }, opts.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const detail = stderrTail.trim();
      if (detail) {
        reject(new Error(`${command} 失败: ${detail}`));
        return;
      }
      reject(
        new Error(
          `${command} 失败（code=${code ?? "null"}${signal ? ` signal=${signal}` : ""}）`,
        ),
      );
    });
  });
}

export async function runFfmpeg(
  args: string[],
  opts?: FfmpegExecOptions,
): Promise<void> {
  await runCommand("ffmpeg", prependQuietGlobalFlags(args), {
    timeoutMs: opts?.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS,
    captureStdout: false,
  });
}

export async function runFfprobe(
  args: string[],
  opts?: FfmpegExecOptions,
): Promise<string> {
  return runCommand("ffprobe", prependQuietGlobalFlags(args), {
    timeoutMs: opts?.timeoutMs ?? DEFAULT_FFPROBE_TIMEOUT_MS,
    captureStdout: true,
  });
}
