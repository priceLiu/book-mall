import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storyCorsHeaders } from "@/lib/story/cors";
import {
  ensureStorySpaceForUser,
  getStorySpaceBySlug,
  updateStorySpaceForUser,
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

/** GET：当前用户空间（不存在则自动创建） */
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
  return NextResponse.json({ space }, { headers: jsonHeaders(request) });
}

/** PATCH：更新当前用户空间首页字段 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: jsonHeaders(request) });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: jsonHeaders(request) });
  }

  const patch: Parameters<typeof updateStorySpaceForUser>[1] = {};
  const str = (k: keyof typeof patch) => {
    const v = body[k as string];
    if (typeof v === "string") (patch as Record<string, string>)[k as string] = v;
  };
  str("title");
  str("tagline");
  str("subtitle");
  str("ownerDisplayName");
  str("featuredWorkTitle");
  str("featuredWorkDescription");
  str("featuredVideoUrl");
  str("featuredVideoPosterUrl");
  if (body.templateKey === "CLASSIC_V1") patch.templateKey = "CLASSIC_V1";

  const space = await updateStorySpaceForUser(session.user.id, patch);
  return NextResponse.json({ space }, { headers: jsonHeaders(request) });
}
