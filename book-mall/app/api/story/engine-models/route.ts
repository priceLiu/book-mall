import { NextRequest, NextResponse } from "next/server";
import { storyCorsHeaders } from "@/lib/story/cors";
import { listStoryEngineModels } from "@/lib/story/story-space-service";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "public, max-age=300", ...storyCorsHeaders(request) },
  });
}

export async function GET(request: NextRequest) {
  const models = await listStoryEngineModels();
  return NextResponse.json(
    { models },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        ...storyCorsHeaders(request),
      },
    },
  );
}
