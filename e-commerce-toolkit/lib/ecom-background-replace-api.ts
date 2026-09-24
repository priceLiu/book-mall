import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { BackgroundReplaceFormState } from "@/lib/background-replace-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/background-replace";

export async function fetchBackgroundReplaceModels(): Promise<{
  imageModels: StoryboardGatewayModel[];
  defaultModel: string;
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  const imageModels = Array.isArray(data.imageModels)
    ? (data.imageModels as StoryboardGatewayModel[])
    : [];
  return {
    imageModels,
    defaultModel:
      typeof data.defaultModel === "string"
        ? data.defaultModel
        : "doubao-seedream-5-0-pro",
  };
}

export async function cutoutEcomBackgroundSubject(opts: {
  sourceImageUrl: string;
}): Promise<{ cutoutUrl: string }> {
  const data = await ecomBookFetch(`${BASE}/cutout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceImageUrl: opts.sourceImageUrl }),
  });
  const cutoutUrl = typeof data.cutoutUrl === "string" ? data.cutoutUrl.trim() : "";
  if (!cutoutUrl) throw new Error("抠图未返回有效主体");
  return { cutoutUrl };
}

export async function replaceEcomBackground(opts: {
  baseImageUrl: string;
  form: BackgroundReplaceFormState;
  bbox?: [number, number, number, number];
  subjectAlreadyCutout?: boolean;
  sourceModule?: string;
  projectId?: string;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId?: string; modelKey?: string }> {
  const data = await ecomBookFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseImageUrl: opts.baseImageUrl,
      modelKey: opts.form.modelKey,
      refPrompt: opts.form.refPrompt.trim() || undefined,
      refImageUrl: opts.form.refImageUrl.trim() || undefined,
      negRefPrompt: opts.form.negRefPrompt.trim() || undefined,
      modelVersion: opts.form.modelVersion,
      n: opts.form.n,
      noiseLevel: opts.form.refImageUrl.trim() ? opts.form.noiseLevel : undefined,
      refPromptWeight:
        opts.form.refPrompt.trim() && opts.form.refImageUrl.trim()
          ? opts.form.refPromptWeight
          : undefined,
      foregroundEdges: opts.form.foregroundEdges.filter((e) => e.url.trim()),
      backgroundEdges: opts.form.backgroundEdges.filter((e) => e.url.trim()),
      bbox: opts.bbox,
      subjectAlreadyCutout: opts.subjectAlreadyCutout === true,
      sourceModule: opts.sourceModule,
      projectId: opts.projectId,
      clientPage: opts.clientPage,
    }),
  });
  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : [];
  if (imageUrls.length === 0) throw new Error("换背景未返回有效图像");
  return {
    imageUrls,
    logId: typeof data.logId === "string" ? data.logId : undefined,
    modelKey: typeof data.modelKey === "string" ? data.modelKey : undefined,
  };
}
