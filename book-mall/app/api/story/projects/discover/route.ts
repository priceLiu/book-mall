import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { storyCorsHeaders } from "@/lib/story/cors";
import { listStoryDiscoverProjectsPage } from "@/lib/story/story-discover-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

function parsePageParams(request: NextRequest): { offset: number; limit: number } {
  const sp = request.nextUrl.searchParams;
  const offset = Math.max(0, Number.parseInt(sp.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(
    24,
    Math.max(1, Number.parseInt(sp.get("limit") ?? "12", 10) || 12),
  );
  return { offset, limit };
}

/** GET · 门户创作室公开作品列表（无需登录，支持 offset/limit 分页） */
export async function GET(request: NextRequest) {
  try {
    const { offset, limit } = parsePageParams(request);
    const page = await listStoryDiscoverProjectsPage(offset, limit);
    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "public, max-age=120",
        ...storyCorsHeaders(request),
      },
    });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
