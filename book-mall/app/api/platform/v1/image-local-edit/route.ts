import { type NextRequest, NextResponse } from "next/server";

import { resolvePlatformUser } from "@/lib/platform-auth";
import { parseLocalEditSelection } from "@/lib/image-local-edit/parse-local-edit-selection";
import { runLocalImageEdit } from "@/lib/image-local-edit/run-local-image-edit";
import type { LocalEditClientApp } from "@/lib/image-local-edit/types";
import {
  runWithImageProcessingContext,
  type ImageProcessingClientApp,
} from "@/lib/ecom/image-processing-request-context";

export const dynamic = "force-dynamic";

function parseClientApp(raw: unknown): LocalEditClientApp | null {
  if (raw === "canvas" || raw === "ecom" || raw === "common-tools") return raw;
  return null;
}

function toImageProcessingClientApp(app: LocalEditClientApp): ImageProcessingClientApp {
  return app === "common-tools" ? "common-tools" : "e-commerce";
}

export async function POST(request: NextRequest) {
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientApp = parseClientApp(body.clientApp);
  if (!clientApp) {
    return NextResponse.json({ error: "clientApp 必填" }, { status: 400 });
  }

  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;
  const parameters =
    body.parameters && typeof body.parameters === "object"
      ? (body.parameters as Record<string, unknown>)
      : undefined;

  const sourceImageUrls = Array.isArray(body.sourceImageUrls)
    ? body.sourceImageUrls
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u) => u.trim())
    : [];

  if (!modelKey) {
    return NextResponse.json({ error: "modelKey 必填" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
  }
  if (sourceImageUrls.length === 0) {
    return NextResponse.json({ error: "sourceImageUrls 必填" }, { status: 400 });
  }

  const selection = parseLocalEditSelection(body.selection);
  const persistEcomAssets = clientApp !== "canvas";

  let sourceImageSize: { width: number; height: number } | undefined;
  const rawSize = body.sourceImageSize;
  if (rawSize && typeof rawSize === "object") {
    const w = Number((rawSize as { width?: unknown }).width);
    const h = Number((rawSize as { height?: unknown }).height);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      sourceImageSize = { width: Math.round(w), height: Math.round(h) };
    }
  }

  try {
    const run = () =>
      runLocalImageEdit({
        userId: user.id,
        modelKey,
        prompt,
        sourceImageUrls,
        selection,
        sourceImageSize,
        parameters,
        clientApp,
        clientPage,
        persistEcomAssets,
        ecomMode: persistEcomAssets ? "retouch" : undefined,
      });

    const result =
      clientApp === "canvas"
        ? await run()
        : await runWithImageProcessingContext(
            { clientApp: toImageProcessingClientApp(clientApp) },
            run,
          );

    return NextResponse.json({
      imageUrls: result.imageUrls,
      logId: result.logId,
      modelKey: result.modelKeyUsed,
      creditsCharged: result.creditsCharged ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "局部编辑失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
