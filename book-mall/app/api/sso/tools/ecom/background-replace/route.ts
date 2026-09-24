import { NextResponse } from "next/server";

import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { runEcomBackgroundReplace } from "@/lib/ecom/ecom-background-replace-service";
import type { BackgroundReplaceEdgeItem } from "@/lib/ecom/ecom-background-replace";
import { formatEcomImageProcessingUserError } from "@/lib/ecom/ecom-image-processing-error";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseEdges(raw: unknown): BackgroundReplaceEdgeItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: BackgroundReplaceEdgeItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const url = typeof (row as { url?: unknown }).url === "string"
      ? (row as { url: string }).url.trim()
      : "";
    if (!url) continue;
    const prompt =
      typeof (row as { prompt?: unknown }).prompt === "string"
        ? (row as { prompt: string }).prompt
        : undefined;
    out.push({ url, prompt });
  }
  return out.length ? out : undefined;
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const baseImageUrl =
    typeof body.baseImageUrl === "string" ? body.baseImageUrl.trim() : "";
  if (!baseImageUrl) {
    return NextResponse.json({ error: "缺少主体图 baseImageUrl" }, { status: 400 });
  }

  const sourceModule =
    typeof body.sourceModule === "string" && body.sourceModule.trim()
      ? body.sourceModule.trim()
      : "background-replace";
  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;

  try {
    const result = await runEcomBackgroundReplace({
      userId: auth.userId,
      clientPage,
      input: {
        baseImageUrl,
        refPrompt: typeof body.refPrompt === "string" ? body.refPrompt : undefined,
        refImageUrl: typeof body.refImageUrl === "string" ? body.refImageUrl : undefined,
        negRefPrompt: typeof body.negRefPrompt === "string" ? body.negRefPrompt : undefined,
        foregroundEdges: parseEdges(body.foregroundEdges),
        backgroundEdges: parseEdges(body.backgroundEdges),
        n: typeof body.n === "number" ? body.n : Number(body.n) || undefined,
        modelVersion: body.modelVersion === "v2" ? "v2" : "v3",
        noiseLevel:
          typeof body.noiseLevel === "number" ? body.noiseLevel : undefined,
        refPromptWeight:
          typeof body.refPromptWeight === "number" ? body.refPromptWeight : undefined,
      },
    });

    const prompt = typeof body.refPrompt === "string" ? body.refPrompt : null;
    await Promise.all(
      result.imageUrls.map((ossUrl, index) =>
        persistEcomGenerationRecord({
          userId: auth.userId,
          ossUrl,
          kind: "image",
          title:
            result.imageUrls.length > 1 ? `换背景 ${index + 1}` : "换背景",
          prompt,
          thumbnailUrl: ossUrl,
          meta: {
            sourceModule,
            sourceToolKey: "ecom-toolkit__background-replace",
            projectId,
            modelKey: "wanx-background-generation-v2",
          },
        }).catch(() => undefined),
      ),
    );

    return NextResponse.json({
      imageUrls: result.imageUrls,
      logId: result.logId,
      creditsCharged: result.creditsCharged ?? undefined,
    });
  } catch (e) {
    const { message, status } = formatEcomImageProcessingUserError(e);
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
