const MIN_TRIM_LEN_SEC = 0.2;

export function trimDurationSlackSecForTest(clipLenSec: number): number {
  return trimDurationSlackSec(clipLenSec);
}

export function assertCanvasVideoTrimOutputDurationForTest(
  outDur: number | null,
  clipLenSec: number,
  sourceDur: number,
): number {
  return assertTrimOutputDuration(outDur, clipLenSec, sourceDur);
}

function trimDurationSlackSec(clipLenSec: number): number {
  return Math.max(0.55, clipLenSec * 0.1);
}

export function assertTrimOutputDuration(
  outDur: number | null,
  clipLenSec: number,
  sourceDur: number,
): number {
  if (outDur == null || !Number.isFinite(outDur) || outDur <= 0) {
    throw new Error("无法验证裁剪结果时长，请重试");
  }
  const slack = trimDurationSlackSec(clipLenSec);
  if (Math.abs(outDur - clipLenSec) <= slack) {
    return outDur;
  }
  const wantedShorter = clipLenSec < sourceDur - 0.75;
  if (wantedShorter && outDur > sourceDur - 0.5) {
    throw new Error("裁剪未生效：输出仍为全长视频，请稍后重试");
  }
  throw new Error(
    `裁剪结果时长异常（期望约 ${clipLenSec.toFixed(1)} 秒，实际 ${outDur.toFixed(1)} 秒）`,
  );
}

export { MIN_TRIM_LEN_SEC };
