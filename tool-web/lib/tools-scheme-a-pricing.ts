/**
 * 方案 A：AI 试衣 / 文生图 / 图生视频（及同 task 的文生视频、参考生视频）与实验室分析室同一套零售系数。
 * 真源：{@link ../config/tools-scheme-a-catalog.json}
 */
import catalog from "@/config/tools-scheme-a-catalog.json";
import { WANX_TEXT2IMAGE_PLUS_MODEL } from "@/lib/text-to-image-dashscope";

type SrKey = "480" | "720" | "1080";

type VideoModelSpec =
  | { flatYuanPerSecond: number }
  | { bySr: Record<string, number> }
  | { bySrAudio: Record<string, { true: number; false: number }> };

type CatalogShape = {
  retailMultiplier: number;
  schemeNote?: string;
  aiTryOn: {
    defaultModel: string;
    models: Record<string, { costYuanPerOutputImage: number; tierNote: string }>;
  };
  textToImage: {
    defaultModel: string;
    models: Record<string, { costYuanPerImage: number; tierNote: string }>;
  };
  video: {
    models: Record<string, VideoModelSpec>;
  };
};

const cat = catalog as CatalogShape;

/** 主站规则/缓存不可用时，与 `tools-scheme-a-catalog.json` 对齐的回退系数。 */
export function toolsSchemeARetailMultiplierCatalogFallback(): number {
  const m = cat.retailMultiplier;
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 2;
}

function roundPoints(retailYuan: number): number {
  return Math.max(1, Math.round(retailYuan * 100));
}

/** 试衣 billing 用模型 id：环境变量仅在 catalog 有对应条目时生效，否则回落默认。 */
export function resolveAiTryOnBillingModelId(): string {
  const env = process.env.DASHSCOPE_TRYON_MODEL?.trim();
  if (env && cat.aiTryOn.models[env]) return env;
  return cat.aiTryOn.defaultModel;
}

export function computeAiTryOnChargePoints(
  modelId?: string,
  retailMult: number = toolsSchemeARetailMultiplierCatalogFallback(),
): number {
  const id = modelId?.trim() || resolveAiTryOnBillingModelId();
  const row = cat.aiTryOn.models[id] ?? cat.aiTryOn.models[cat.aiTryOn.defaultModel];
  if (!row) return 0;
  const retail = row.costYuanPerOutputImage * retailMult;
  return roundPoints(retail);
}

export function computeTextToImageChargePoints(
  imageCount: number,
  modelId?: string,
  retailMult: number = toolsSchemeARetailMultiplierCatalogFallback(),
): number {
  const n =
    typeof imageCount === "number" && Number.isFinite(imageCount)
      ? Math.max(1, Math.min(4, Math.floor(imageCount)))
      : 1;
  const id = modelId?.trim() || cat.textToImage.defaultModel;
  const row = cat.textToImage.models[id];
  if (!row) return 0;
  const retail = row.costYuanPerImage * n * retailMult;
  return roundPoints(retail);
}

/** 当前产品固定模型（与 start 任务一致） */
export function getTextToImageSchemeModelId(): string {
  return WANX_TEXT2IMAGE_PLUS_MODEL;
}

export function usageSrToBucket(sr: number): SrKey {
  if (!Number.isFinite(sr) || sr <= 0) return "720";
  if (sr <= 480) return "480";
  if (sr <= 720) return "720";
  return "1080";
}

export function getVideoCostYuanPerSecond(opts: {
  apiModel: string;
  sr: number;
  audio: boolean;
}): number | null {
  const model = opts.apiModel.trim();
  const spec = cat.video.models[model];
  if (!spec) return null;

  if ("flatYuanPerSecond" in spec) {
    return spec.flatYuanPerSecond;
  }
  if ("bySr" in spec) {
    const bucket = usageSrToBucket(opts.sr);
    const rate = spec.bySr[bucket];
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  }
  if ("bySrAudio" in spec) {
    const bucket = usageSrToBucket(opts.sr);
    const row = spec.bySrAudio[bucket];
    if (!row) return null;
    const r = row[String(opts.audio) as "true" | "false"];
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }
  return null;
}

export function computeVideoChargePoints(
  opts: {
    apiModel: string;
    durationSec: number;
    sr: number;
    audio: boolean;
  },
  retailMult: number = toolsSchemeARetailMultiplierCatalogFallback(),
): number {
  const dur =
    typeof opts.durationSec === "number" && Number.isFinite(opts.durationSec)
      ? Math.max(1, Math.min(120, Math.ceil(opts.durationSec)))
      : 1;
  const yps = getVideoCostYuanPerSecond(opts);
  if (yps == null || yps <= 0) return 0;
  const retail = yps * dur * retailMult;
  return roundPoints(retail);
}

export type ToolsSchemeAPriceRow = {
  segment: string;
  lineId: string;
  title: string;
  pricePoints: number;
  yuan: number;
  note: string;
};

export function listToolsSchemeAPriceRows(
  retailMult: number = toolsSchemeARetailMultiplierCatalogFallback(),
): ToolsSchemeAPriceRow[] {
  const mult = retailMult;
  const out: ToolsSchemeAPriceRow[] = [];

  for (const [id, row] of Object.entries(cat.aiTryOn.models)) {
    const pts = computeAiTryOnChargePoints(id, mult);
    out.push({
      segment: "aiTryOn",
      lineId: `scheme-a:ai-try-on:${id}`,
      title: `AI 试衣 · ${id}`,
      pricePoints: pts,
      yuan: pts / 100,
      note: `方案 A · ${row.tierNote} · 单次成片 ×${mult}`,
    });
  }

  for (const [id, row] of Object.entries(cat.textToImage.models)) {
    const ptsOne = computeTextToImageChargePoints(1, id, mult);
    out.push({
      segment: "textToImage",
      lineId: `scheme-a:text-to-image:${id}:n1`,
      title: `文生图 · ${id}（每张）`,
      pricePoints: ptsOne,
      yuan: ptsOne / 100,
      note: `方案 A · ${row.tierNote} · 按成功生成张数累计 ×${mult}`,
    });
  }

  for (const [apiModel, spec] of Object.entries(cat.video.models)) {
    let sampleYps = 0;
    let noteExtra = "";
    if ("flatYuanPerSecond" in spec) {
      sampleYps = spec.flatYuanPerSecond;
      noteExtra = `一口价 ${sampleYps} 元/秒（中国内地首档）`;
    } else if ("bySr" in spec) {
      sampleYps = spec.bySr["720"] ?? spec.bySr["480"] ?? Object.values(spec.bySr)[0] ?? 0;
      noteExtra = "按输出分辨率档位（480P/720P/1080P）取价 · 元/秒";
    } else if ("bySrAudio" in spec) {
      sampleYps = spec.bySrAudio["720"]?.true ?? 0;
      noteExtra = "按分辨率与 audio 档位取价 · 元/秒";
    }
    if (sampleYps <= 0) continue;
    const pts5 = computeVideoChargePoints(
      {
        apiModel,
        durationSec: 5,
        sr: 720,
        audio: true,
      },
      mult,
    );
    out.push({
      segment: "imageToVideo",
      lineId: `scheme-a:video:${apiModel}:demo5s720p`,
      title: `视频合成 · ${apiModel}（示例 5s·720P·有声）`,
      pricePoints: pts5,
      yuan: pts5 / 100,
      note: `方案 A · ${noteExtra}；示例按 5 秒估算，实扣 = 秒数×单价×${mult} 后取整`,
    });
  }

  return out;
}

/** 价格表页：按模型各自拉主站系数后生成的方案 A 行。 */
export async function listToolsSchemeAPriceRowsAsync(
  getMult: (toolKey: string, modelId: string) => Promise<number>,
): Promise<ToolsSchemeAPriceRow[]> {
  const out: ToolsSchemeAPriceRow[] = [];

  const tkFit = "fitting-room__ai-fit";
  for (const [id, row] of Object.entries(cat.aiTryOn.models)) {
    const mult = await getMult(tkFit, id);
    const pts = computeAiTryOnChargePoints(id, mult);
    out.push({
      segment: "aiTryOn",
      lineId: `scheme-a:ai-try-on:${id}`,
      title: `AI 试衣 · ${id}`,
      pricePoints: pts,
      yuan: pts / 100,
      note: `方案 A · ${row.tierNote} · 单次成片 ×${mult}`,
    });
  }

  const tkImg = "text-to-image";
  for (const [id, row] of Object.entries(cat.textToImage.models)) {
    const mult = await getMult(tkImg, id);
    const ptsOne = computeTextToImageChargePoints(1, id, mult);
    out.push({
      segment: "textToImage",
      lineId: `scheme-a:text-to-image:${id}:n1`,
      title: `文生图 · ${id}（每张）`,
      pricePoints: ptsOne,
      yuan: ptsOne / 100,
      note: `方案 A · ${row.tierNote} · 按成功生成张数累计 ×${mult}`,
    });
  }

  const tkVid = "image-to-video";
  for (const [apiModel, spec] of Object.entries(cat.video.models)) {
    let sampleYps = 0;
    let noteExtra = "";
    if ("flatYuanPerSecond" in spec) {
      sampleYps = spec.flatYuanPerSecond;
      noteExtra = `一口价 ${sampleYps} 元/秒（中国内地首档）`;
    } else if ("bySr" in spec) {
      sampleYps = spec.bySr["720"] ?? spec.bySr["480"] ?? Object.values(spec.bySr)[0] ?? 0;
      noteExtra = "按输出分辨率档位（480P/720P/1080P）取价 · 元/秒";
    } else if ("bySrAudio" in spec) {
      sampleYps = spec.bySrAudio["720"]?.true ?? 0;
      noteExtra = "按分辨率与 audio 档位取价 · 元/秒";
    }
    if (sampleYps <= 0) continue;
    const mult = await getMult(tkVid, apiModel);
    const pts5 = computeVideoChargePoints(
      {
        apiModel,
        durationSec: 5,
        sr: 720,
        audio: true,
      },
      mult,
    );
    out.push({
      segment: "imageToVideo",
      lineId: `scheme-a:video:${apiModel}:demo5s720p`,
      title: `视频合成 · ${apiModel}（示例 5s·720P·有声）`,
      pricePoints: pts5,
      yuan: pts5 / 100,
      note: `方案 A · ${noteExtra}；示例按 5 秒估算，实扣 = 秒数×单价×${mult} 后取整`,
    });
  }

  return out;
}
