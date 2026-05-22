import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storyCorsHeaders } from "@/lib/story/cors";
import { getStorySpaceBySlug } from "@/lib/story/story-space-service";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=60",
      ...storyCorsHeaders(request),
    },
  });
}

/** GET：按 slug 读取空间（已发布公开；本人可读草稿） */
export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const session = await getServerSession(authOptions);
  const space = await getStorySpaceBySlug(slug, session?.user?.id);
  if (!space) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: storyCorsHeaders(request) },
    );
  }
  return NextResponse.json(
    { space },
    {
      headers: {
        "Cache-Control": space.publishStatus === "PUBLISHED" ? "public, max-age=60" : "private, no-store",
        ...storyCorsHeaders(request),
      },
    },
  );
}
