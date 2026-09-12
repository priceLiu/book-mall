import { NextResponse } from "next/server";

import { editImageLayerRegion } from "@/lib/ecom/ecom-image-layer-service";
import {
  appendEcomImageLayerGeneration,
  saveEcomImageLayerWorkspace,
  workspaceFromStack,
} from "@/lib/ecom/ecom-image-layer-project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseBbox(raw: unknown): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const nums = raw.slice(0, 4).map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
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

  const compositeImageUrl =
    typeof body.compositeImageUrl === "string" ? body.compositeImageUrl.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const bbox = parseBbox(body.bbox);
  const size = typeof body.size === "string" ? body.size.trim() : undefined;
  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  if (!compositeImageUrl) {
    return NextResponse.json({ error: "缺少 compositeImageUrl" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });
  }
  if (!bbox) {
    return NextResponse.json({ error: "缺少有效 bbox" }, { status: 400 });
  }

  try {
    const stack = await editImageLayerRegion({
      userId: auth.userId,
      compositeImageUrl,
      bbox,
      prompt,
      size,
    });
    if (projectId) {
      await saveEcomImageLayerWorkspace(
        auth.userId,
        projectId,
        workspaceFromStack(stack, { sourceImageUrl: stack.sourceImageUrl ?? compositeImageUrl }),
      );
      await appendEcomImageLayerGeneration(auth.userId, projectId, {
        kind: "edit",
        title: "AI 修改本层",
        prompt,
        ossUrl: stack.background.url,
        logId: stack.logId ?? null,
      });
    }
    return NextResponse.json({ stack });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "图层编辑失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
