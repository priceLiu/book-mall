import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  createAssistantQaEntry,
  getAssistantQaSummary,
  listAssistantQaEntries,
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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const [items, summary] = await Promise.all([
    listAssistantQaEntries(),
    getAssistantQaSummary(),
  ]);
  return NextResponse.json({ items, summary });
}

export async function POST(request: Request) {
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
    const item = await createAssistantQaEntry(
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
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
