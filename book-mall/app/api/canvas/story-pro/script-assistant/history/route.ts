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
  listScriptAssistantHistoryThreads,
  saveScriptAssistantHistory,
  type ScriptAssistantMessage,
} from "@/lib/canvas/story-pro-script-assistant-service";

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
    const workflowKey = request.nextUrl.searchParams.get("workflowKey");
    const listThreads =
      request.nextUrl.searchParams.get("listThreads") === "1";

    if (listThreads) {
      const threads = await listScriptAssistantHistoryThreads(
        guard.user.id,
        projectId,
      );
      return NextResponse.json({ threads }, { headers: jsonHeaders(request) });
    }

    const messages = await getScriptAssistantHistory(
      guard.user.id,
      projectId,
      workflowKey,
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
    const workflowKey =
      body.workflowKey === undefined || body.workflowKey === null
        ? undefined
        : String(body.workflowKey);
    const theme =
      body.theme === undefined || body.theme === null
        ? undefined
        : String(body.theme);
    const messages = (body.messages ?? []) as ScriptAssistantMessage[];
    const saved = await saveScriptAssistantHistory(
      guard.user.id,
      projectId,
      messages,
      { workflowKey, theme },
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
    const workflowKey = request.nextUrl.searchParams.get("workflowKey");
    await clearScriptAssistantHistory(
      guard.user.id,
      projectId,
      workflowKey,
    );
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
