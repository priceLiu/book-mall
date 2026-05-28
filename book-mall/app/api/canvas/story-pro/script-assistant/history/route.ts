import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  clearScriptAssistantHistory,
  getScriptAssistantHistory,
  saveScriptAssistantHistory,
  type ScriptAssistantMessage,
} from "@/lib/canvas/story-pro-script-assistant-service";

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
    const messages = await getScriptAssistantHistory(
      guard.user.id,
      projectId,
    );
    return NextResponse.json({ messages }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const projectId = String(body.projectId ?? "");
    const messages = (body.messages ?? []) as ScriptAssistantMessage[];
    const saved = await saveScriptAssistantHistory(
      guard.user.id,
      projectId,
      messages,
    );
    return NextResponse.json({ messages: saved }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
    await clearScriptAssistantHistory(guard.user.id, projectId);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
