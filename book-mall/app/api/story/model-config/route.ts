import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storyCorsHeaders } from "@/lib/story/cors";
import {
  ensureStorySpaceForUser,
  updateStoryModelConfig,
} from "@/lib/story/story-space-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function jsonHeaders(request: NextRequest) {
  return { ...privateHeaders, ...storyCorsHeaders(request) };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: jsonHeaders(request) });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: jsonHeaders(request) });
  }
  const space = await ensureStorySpaceForUser({
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  });
  return NextResponse.json(
    { space, selections: space.modelSelections },
    { headers: jsonHeaders(request) },
  );
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: jsonHeaders(request) });
  }
  let body: { updates?: { engineModelId: string; enabled?: boolean; isPrimary?: boolean; params?: unknown }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: jsonHeaders(request) });
  }
  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "updates_required" }, { status: 400, headers: jsonHeaders(request) });
  }
  const space = await updateStoryModelConfig(session.user.id, body.updates);
  return NextResponse.json({ space, selections: space.modelSelections }, { headers: jsonHeaders(request) });
}
