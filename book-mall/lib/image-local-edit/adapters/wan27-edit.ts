import { ensurePublicImageUrl } from "../image-url";
import { invokeWan27LocalEdit } from "../gateway-invoke";
import { pollDashscopeImageJob } from "../poll-dashscope-image";
import {
  LOCAL_EDIT_WAN27_MODEL_KEY,
  normalizeBbox,
  validateBbox,
  WAN27_MAX_BBOX_PER_IMAGE,
} from "../model-capabilities";
import type { LocalEditBbox, LocalEditClientApp, LocalEditSelection } from "../types";

function resolveBboxList(selection: LocalEditSelection): LocalEditBbox[][] {
  if (selection.kind === "bbox") {
    return [[normalizeBbox(selection.bbox)]];
  }
  if (selection.kind === "multi-bbox") {
    return selection.bboxList.map((boxes) =>
      boxes.slice(0, WAN27_MAX_BBOX_PER_IMAGE).map(normalizeBbox),
    );
  }
  throw new Error("万相 2.7 Pro 局部重绘需要框选区域");
}

export async function runWan27LocalEditAdapter(opts: {
  userId: string;
  clientApp: LocalEditClientApp;
  prompt: string;
  sourceImageUrls: string[];
  selection: LocalEditSelection;
  parameters?: Record<string, unknown>;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string }> {
  const bboxListNormalized = resolveBboxList(opts.selection);
  const sourceUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageUrls[0]!);
  const content: Array<{ text: string } | { image: string }> = [
    { image: sourceUrl },
    { text: opts.prompt.trim() },
  ];
  const params = { ...(opts.parameters ?? {}) };
  const size = typeof params.size === "string" ? params.size : undefined;
  const n = params.n !== undefined ? Number(params.n) : 1;
  if (params.size !== undefined) delete params.size;
  if (params.n !== undefined) delete params.n;

  const bboxList = bboxListNormalized.map((boxes) =>
    boxes.map((b) => [...b] as number[]),
  );

  const { taskId, logId } = await invokeWan27LocalEdit({
    userId: opts.userId,
    clientApp: opts.clientApp,
    modelKey: LOCAL_EDIT_WAN27_MODEL_KEY,
    content,
    size,
    n,
    bboxList,
    clientPage: opts.clientPage,
  });
  const vendorUrl = await pollDashscopeImageJob(opts.userId, taskId, logId);
  return { imageUrls: [vendorUrl], logId };
}

export { validateBbox };
