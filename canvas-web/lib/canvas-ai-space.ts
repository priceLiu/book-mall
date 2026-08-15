import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

/**
 * 我的 AI 空间（book-mall Platform API）。
 * Pin 只保存指向原作品的引用，不复制 OSS 文件。
 */
const PINS_PATH = "/api/platform/v1/ai-space/pins";

export type CanvasAiSpaceSourceType = "i2v_library";

export async function pinToAiSpace(
  base: string,
  sourceType: CanvasAiSpaceSourceType,
  sourceId: string,
): Promise<void> {
  const { url, init } = resolveBookMallBrowserRequest(base, PINS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType, sourceId }),
  });
  const r = await fetch(url, init);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `展示到 AI 空间失败（HTTP ${r.status}）`);
  }
}

export type CanvasAiSpaceDigitalHuman = {
  id: string;
  name: string;
  avatarImageUrl: string;
  status: string;
};

export type CanvasAiSpaceAudio = {
  id: string;
  name: string;
  audioUrl: string;
  durationSec: number;
  textScript: string | null;
};

/** 选用器：平台数字人形象（真源在 book-mall，画布只引用 id 与 URL） */
export async function listAiSpaceDigitalHumans(
  base: string,
): Promise<CanvasAiSpaceDigitalHuman[]> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    "/api/platform/v1/ai-space/digital-humans?activeOnly=1",
    { method: "GET" },
  );
  const r = await fetch(url, init);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `读取数字人库失败（HTTP ${r.status}）`);
  }
  const data = (await r.json()) as { items?: CanvasAiSpaceDigitalHuman[] };
  return data.items ?? [];
}

/** 选用器：平台音频库；`maxDurationSec` 按门禁过滤 */
export async function listAiSpaceAudioAssets(
  base: string,
  maxDurationSec?: number,
): Promise<CanvasAiSpaceAudio[]> {
  const qs =
    maxDurationSec && maxDurationSec > 0 ? `?maxDurationSec=${maxDurationSec}` : "";
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/platform/v1/ai-space/audio-assets${qs}`,
    { method: "GET" },
  );
  const r = await fetch(url, init);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `读取音频库失败（HTTP ${r.status}）`);
  }
  const data = (await r.json()) as { assets?: CanvasAiSpaceAudio[] };
  return data.assets ?? [];
}

/** 删源前查是否已展示；失败按未展示处理，不阻断删除。 */
export async function isPinnedInAiSpace(
  base: string,
  sourceType: CanvasAiSpaceSourceType,
  sourceId: string,
): Promise<boolean> {
  try {
    const { url, init } = resolveBookMallBrowserRequest(
      base,
      `${PINS_PATH}/check?sourceType=${sourceType}&sourceId=${encodeURIComponent(sourceId)}`,
      { method: "GET" },
    );
    const r = await fetch(url, init);
    if (!r.ok) return false;
    const data = (await r.json()) as { pinnedCount?: number };
    return Number(data.pinnedCount ?? 0) > 0;
  } catch {
    return false;
  }
}
