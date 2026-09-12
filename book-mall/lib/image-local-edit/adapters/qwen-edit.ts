import { ensurePublicImageUrl } from "../image-url";
import { invokeQwenLocalEdit } from "../gateway-invoke";
import type { LocalEditClientApp, LocalEditSelection } from "../types";

function buildQwenLocalEditPrompt(prompt: string, hasMask: boolean): string {
  const base = prompt.trim();
  if (!hasMask) return base;
  return `${base}\n\n请仅修改第二张蒙版图像中白色区域所对应的原图位置，蒙版外区域保持与原图完全一致。`;
}

function buildQwenContent(opts: {
  imageUrls: string[];
  prompt: string;
  maskUrl?: string;
}) {
  const content: Array<{ image?: string; text?: string }> = [];
  for (const img of opts.imageUrls) {
    content.push({ image: img });
  }
  if (opts.maskUrl) {
    content.push({ image: opts.maskUrl });
  }
  content.push({
    text: buildQwenLocalEditPrompt(opts.prompt, Boolean(opts.maskUrl)),
  });
  return content;
}

export async function runQwenLocalEditAdapter(opts: {
  userId: string;
  clientApp: LocalEditClientApp;
  modelKey: string;
  prompt: string;
  sourceImageUrls: string[];
  selection?: LocalEditSelection;
  parameters?: Record<string, unknown>;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string }> {
  const imageUrls = await Promise.all(
    opts.sourceImageUrls.map((u) => ensurePublicImageUrl(opts.userId, u)),
  );
  let maskUrl: string | undefined;
  if (opts.selection?.kind === "mask") {
    maskUrl = await ensurePublicImageUrl(opts.userId, opts.selection.maskDataUrl);
  }
  const content = buildQwenContent({
    imageUrls,
    prompt: opts.prompt,
    maskUrl,
  });
  return invokeQwenLocalEdit({
    userId: opts.userId,
    clientApp: opts.clientApp,
    modelKey: opts.modelKey,
    content,
    parameters: opts.parameters,
    clientPage: opts.clientPage,
  });
}
