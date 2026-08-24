import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  deleteAssistantQaEntry,
  updateAssistantQaEntry,
} from "@/lib/platform-assistant/qa-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role ?? "").toUpperCase();
  if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
    return null;
  }
  return session.user;
}

export async function PUT(
  request: NextRequest,
  ctx: { params: { id: string } },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const item = await updateAssistantQaEntry(
      ctx.params.id,
      {
        question: String(body.question ?? ""),
        answer: String(body.answer ?? ""),
        enabled: body.enabled !== false,
        sortOrder: Number(body.sortOrder ?? 0),
        matchMode:
          body.matchMode === "EXACT" ||
          body.matchMode === "KEYWORDS" ||
          body.matchMode === "CONTAINS"
            ? body.matchMode
            : "CONTAINS",
        matchKeywords: Array.isArray(body.matchKeywords)
          ? body.matchKeywords.map(String)
          : typeof body.matchKeywords === "string"
            ? body.matchKeywords.split(/[,，\n]/).map((s) => s.trim())
            : [],
        sourceFeedbackId:
          typeof body.sourceFeedbackId === "string" ? body.sourceFeedbackId : null,
        adminNote: typeof body.adminNote === "string" ? body.adminNote : null,
      },
      admin.id,
    );
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("Record to update not found") ? 404 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: { id: string } },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await deleteAssistantQaEntry(ctx.params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
