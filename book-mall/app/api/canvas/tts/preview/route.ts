import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { previewCanvasTtsSpeech } from "@/lib/canvas/canvas-tts-preview-service";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 画布音频 Dock · 按当前音色与参数实时合成短试听 */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const modelKey = String(body.body.modelKey ?? "").trim();
  const voiceId = String(body.body.voiceId ?? body.body.voice_id ?? "").trim();
  const params =
    body.body.params && typeof body.body.params === "object"
      ? (body.body.params as Record<string, unknown>)
      : {};
  const text =
    typeof body.body.text === "string" ? body.body.text : undefined;
  const projectId =
    typeof body.body.projectId === "string"
      ? body.body.projectId.trim()
      : undefined;
  const billable = body.body.billable === true;

  try {
    const result = await previewCanvasTtsSpeech({
      userId: guard.user.id,
      modelKey,
      voiceId,
      params,
      text,
      projectId,
      billable,
    });
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof CanvasProjectError) {
      return canvasErrorToResponse(request, err);
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "TTS_PREVIEW_FAILED", message },
      { status: 500, headers: jsonHeaders(request) },
    );
  }
}
