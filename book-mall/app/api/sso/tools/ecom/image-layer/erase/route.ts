import { NextResponse } from "next/server";

import { runCanvasImageErase } from "@/lib/canvas-image-edit/run-canvas-image-erase";
import {
  appendEcomImageLayerGeneration,
  saveEcomImageLayerWorkspace,
} from "@/lib/ecom/ecom-image-layer-project-service";
import { formatEcomImageProcessingUserError } from "@/lib/ecom/ecom-image-processing-error";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const sourceImageUrl =
    typeof body.sourceImageUrl === "string" ? body.sourceImageUrl.trim() : "";
  const maskDataUrl =
    typeof body.maskDataUrl === "string" ? body.maskDataUrl.trim() : "";
  let bbox: [number, number, number, number] | undefined;
  if (Array.isArray(body.bbox) && body.bbox.length === 4) {
    const nums = body.bbox.map((v) => Number(v));
    if (nums.every((n) => Number.isFinite(n))) {
      bbox = nums as [number, number, number, number];
    }
  }
  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  if (!sourceImageUrl) {
    return NextResponse.json({ error: "缺少 sourceImageUrl" }, { status: 400 });
  }
  if (!maskDataUrl && !bbox) {
    return NextResponse.json({ error: "请涂抹或框选需要擦除的区域" }, { status: 400 });
  }

  try {
    const result = await runCanvasImageErase({
      userId: auth.userId,
      sourceImageUrl,
      maskDataUrl: maskDataUrl || undefined,
      bbox,
      clientPage: "ecom/image-layer/erase",
    });
    const editedUrl = result.imageUrls[0];
    if (!editedUrl) {
      return NextResponse.json({ error: "擦除未返回有效图像" }, { status: 502 });
    }

    if (projectId) {
      await saveEcomImageLayerWorkspace(auth.userId, projectId, {
        sourceImageUrl: editedUrl,
        stack: null,
        pendingBboxes: [],
        selectedLayerId: null,
        editEntries: [],
      });
      await appendEcomImageLayerGeneration(auth.userId, projectId, {
        kind: "edit",
        title: "图像擦除",
        prompt: "擦除选区并补全背景",
        ossUrl: editedUrl,
        logId: result.logId ?? null,
      });
    }

    return NextResponse.json({
      imageUrl: editedUrl,
      logId: result.logId,
      creditsCharged: result.creditsCharged ?? undefined,
    });
  } catch (e) {
    const { message, status } = formatEcomImageProcessingUserError(e);
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
