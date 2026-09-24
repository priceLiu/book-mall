import { NextResponse } from "next/server";

import { editImageLayerRegions } from "@/lib/ecom/ecom-image-layer-service";
import {
  appendEcomImageLayerGeneration,
  saveEcomImageLayerWorkspace,
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

function parseEdits(
  body: Record<string, unknown>,
): Array<{ bbox: [number, number, number, number]; prompt: string }> {
  if (Array.isArray(body.edits)) {
    const out: Array<{ bbox: [number, number, number, number]; prompt: string }> = [];
    for (const item of body.edits) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const bbox = parseBbox(row.bbox);
      const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
      if (bbox && prompt) out.push({ bbox, prompt });
    }
    return out;
  }

  const bbox = parseBbox(body.bbox);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (bbox && prompt) return [{ bbox, prompt }];
  return [];
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
  const edits = parseEdits(body);
  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : undefined;

  if (!compositeImageUrl) {
    return NextResponse.json({ error: "缺少 compositeImageUrl" }, { status: 400 });
  }
  if (edits.length === 0) {
    return NextResponse.json({ error: "缺少有效 edits（bbox + prompt）" }, { status: 400 });
  }

  try {
    const result = await editImageLayerRegions({
      userId: auth.userId,
      compositeImageUrl,
      edits,
    });
    if (projectId) {
      await saveEcomImageLayerWorkspace(auth.userId, projectId, {
        sourceImageUrl: result.imageUrl,
        stack: null,
        pendingBboxes: [],
        pendingBbox: null,
        selectedLayerId: null,
        editEntries: [],
      });
      const promptSummary =
        edits.length === 1
          ? edits[0]!.prompt
          : edits.map((e, i) => `层${i + 1}：${e.prompt}`).join("；");
      await appendEcomImageLayerGeneration(auth.userId, projectId, {
        kind: "edit",
        title: edits.length > 1 ? "AI 批量修改图层" : "AI 修改本层",
        prompt: promptSummary,
        ossUrl: result.imageUrl,
        logId: result.logId ?? null,
      });
    }
    return NextResponse.json({ imageUrl: result.imageUrl, logId: result.logId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "图层编辑失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
