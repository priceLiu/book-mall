import { NextResponse } from "next/server";

import {
  readQrAudioPromptTemplates,
  writeQrAudioPromptTemplates,
  type QrAudioPromptTemplateLibrary,
} from "@/lib/quick-replica/qr-audio-prompt-templates";
import { requireQuickReplicaFinanceAdmin } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

function parseLibrary(body: unknown): QrAudioPromptTemplateLibrary | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const templates = root.templates;
  if (!templates || typeof templates !== "object") return null;
  return normalizeFromBody(templates);
}

function normalizeFromBody(raw: unknown): QrAudioPromptTemplateLibrary {
  const lib = readQrAudioPromptTemplates();
  if (!raw || typeof raw !== "object") return lib;
  const root = raw as Record<string, unknown>;
  for (const kind of ["create-voiceover", "voice-changer"] as const) {
    const list = root[kind];
    if (!Array.isArray(list)) continue;
    lib[kind] = list
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id.trim() : "";
        const name = typeof o.name === "string" ? o.name.trim() : "";
        const content = typeof o.content === "string" ? o.content : "";
        if (!id || !name) return null;
        return { id, name, content };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }
  return lib;
}

export async function GET(request: Request) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ templates: readQrAudioPromptTemplates() });
}

export async function PUT(request: Request) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const templates = parseLibrary(body);
  if (!templates) {
    return NextResponse.json({ error: "templates 必填" }, { status: 400 });
  }

  writeQrAudioPromptTemplates(templates);
  return NextResponse.json({ templates: readQrAudioPromptTemplates() });
}
