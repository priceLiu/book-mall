import { NextResponse } from "next/server";

import { buildDecomposePrompt, decomposeImageLayer } from "@/lib/ecom/ecom-image-layer-service";
import {
  appendEcomImageLayerGeneration,
  saveEcomImageLayerWorkspace,
  workspaceFromStack,
} from "@/lib/ecom/ecom-image-layer-project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseBboxes(raw: unknown): Array<[number, number, number, number]> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<[number, number, number, number]> = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const nums = row.slice(0, 4).map((v) => Number(v));
    if (nums.some((n) => !Number.isFinite(n))) continue;
    out.push([nums[0]!, nums[1]!, nums[2]!, nums[3]!]);
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

  const sourceImageUrl =
    typeof body.sourceImageUrl === "string" ? body.sourceImageUrl.trim() : "";
  if (!sourceImageUrl) {
    return NextResponse.json({ error: "缺少 sourceImageUrl" }, { status: 400 });
  }

  const size = typeof body.size === "string" ? body.size.trim() : undefined;
  const bboxes = parseBboxes(body.bboxes);
  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  try {
    const stack = await decomposeImageLayer({
      userId: auth.userId,
      sourceImageUrl,
      bboxes,
      size,
    });
    if (projectId) {
      await saveEcomImageLayerWorkspace(
        auth.userId,
        projectId,
        workspaceFromStack(stack, {
          sourceImageUrl: stack.sourceImageUrl ?? sourceImageUrl,
          pendingBbox: bboxes?.[0] ?? null,
        }),
      );
      const previewUrl = stack.background.url;
      await appendEcomImageLayerGeneration(auth.userId, projectId, {
        kind: "decompose",
        title: "AI 图层分离",
        prompt: buildDecomposePrompt(bboxes ?? []),
        ossUrl: previewUrl,
        logId: stack.logId ?? null,
      });
    }
    return NextResponse.json({ stack });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "图层拆分失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
