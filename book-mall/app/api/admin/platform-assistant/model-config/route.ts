import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  getPlatformAssistantModelConfigView,
  listAssistantEmbedCandidates,
  listAssistantLlmCandidates,
  updatePlatformAssistantModelConfig,
  type PlatformAssistantModelConfigView,
} from "@/lib/platform-assistant/platform-assistant-model-config-service";

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

export type AdminAssistantModelConfigPayload = {
  config: PlatformAssistantModelConfigView;
  llmCandidates: ReturnType<typeof listAssistantLlmCandidates>;
  embedCandidates: ReturnType<typeof listAssistantEmbedCandidates>;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const config = await getPlatformAssistantModelConfigView();
  return NextResponse.json({
    config,
    llmCandidates: listAssistantLlmCandidates(),
    embedCandidates: listAssistantEmbedCandidates(),
  } satisfies AdminAssistantModelConfigPayload);
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: Partial<PlatformAssistantModelConfigView>;
  try {
    body = (await request.json()) as Partial<PlatformAssistantModelConfigView>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const config = await updatePlatformAssistantModelConfig(
      {
        chatEnabled: Boolean(body.chatEnabled),
        chatModelKey: String(body.chatModelKey ?? "").trim(),
        chatFallbackModelKeys: Array.isArray(body.chatFallbackModelKeys)
          ? body.chatFallbackModelKeys.map(String)
          : [],
        newsEnabled: Boolean(body.newsEnabled),
        newsModelKey: String(body.newsModelKey ?? "").trim(),
        newsFallbackModelKeys: Array.isArray(body.newsFallbackModelKeys)
          ? body.newsFallbackModelKeys.map(String)
          : [],
        embedEnabled: Boolean(body.embedEnabled),
        embedModelKey: String(body.embedModelKey ?? "").trim(),
        embedDim: Number(body.embedDim),
      },
      admin.id,
    );
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
