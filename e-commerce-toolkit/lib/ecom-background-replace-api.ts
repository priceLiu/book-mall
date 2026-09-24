import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { BackgroundReplaceFormState } from "@/lib/background-replace-types";

const BASE = "api/sso/tools/ecom/background-replace";

export async function replaceEcomBackground(opts: {
  baseImageUrl: string;
  form: BackgroundReplaceFormState;
  sourceModule?: string;
  projectId?: string;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId?: string }> {
  const data = await ecomBookFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseImageUrl: opts.baseImageUrl,
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
  };
}
