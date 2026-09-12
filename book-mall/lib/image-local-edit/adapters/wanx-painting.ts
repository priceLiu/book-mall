import { ECOM_WANX_PAINTING_MODEL_KEY } from "@/lib/ecom/ecom-image-processing-models";
import { ensurePublicImageUrl } from "../image-url";
import {
  normalizeInpaintMaskDataUrl,
  readImagePixelSize,
} from "../normalize-inpaint-mask";
import { invokeWanxPaintingLocalEdit } from "../gateway-invoke";
import type { LocalEditClientApp, LocalEditSelection } from "../types";

export async function runWanxPaintingLocalEditAdapter(opts: {
  userId: string;
  clientApp: LocalEditClientApp;
  prompt: string;
  sourceImageUrls: string[];
  selection: LocalEditSelection;
  parameters?: Record<string, unknown>;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string }> {
  if (opts.selection.kind !== "mask") {
    throw new Error("万相局部重绘需要涂抹蒙版");
  }
  const sourceInput = opts.sourceImageUrls[0]!;
  const { width, height } = await readImagePixelSize(sourceInput);
  const normalizedMask = await normalizeInpaintMaskDataUrl(
    opts.selection.maskDataUrl,
    width,
    height,
  );
  const baseUrl = await ensurePublicImageUrl(opts.userId, sourceInput);
  const maskUrl = await ensurePublicImageUrl(opts.userId, normalizedMask);
  const params = { ...(opts.parameters ?? {}) };
  const n = params.n !== undefined ? Number(params.n) : 1;
  if (params.n !== undefined) delete params.n;
  return invokeWanxPaintingLocalEdit({
    userId: opts.userId,
    clientApp: opts.clientApp,
    modelKey: ECOM_WANX_PAINTING_MODEL_KEY,
    input: {
      prompt: opts.prompt.trim(),
      base_image_url: baseUrl,
      mask_image_url: maskUrl,
    },
    parameters: { ...params, n },
    clientPage: opts.clientPage,
  });
}
