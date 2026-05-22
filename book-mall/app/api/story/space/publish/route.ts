import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storyCorsHeaders } from "@/lib/story/cors";
import { publishStorySpaceToBookMall } from "@/lib/story/story-space-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...privateHeaders, ...storyCorsHeaders(request) },
  });
}

/** POST：将空间首页发布为 book-mall 产品（可播放代表作） */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { ...privateHeaders, ...storyCorsHeaders(request) } },
    );
  }
  try {
    const space = await publishStorySpaceToBookMall(session.user.id);
    return NextResponse.json({ space }, { headers: { ...privateHeaders, ...storyCorsHeaders(request) } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "publish_failed";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { ...privateHeaders, ...storyCorsHeaders(request) } },
    );
  }
}
