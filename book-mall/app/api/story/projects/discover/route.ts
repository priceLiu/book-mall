import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import { storyCorsHeaders } from "@/lib/story/cors";
import { listStoryDiscoverProjects } from "@/lib/story/story-discover-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 门户创作室公开作品列表（无需登录） */
export async function GET(request: NextRequest) {
  try {
    const projects = await listStoryDiscoverProjects();
    return NextResponse.json(
      { projects },
      {
        headers: {
          "Cache-Control": "public, max-age=120",
          ...storyCorsHeaders(request),
        },
      },
    );
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
