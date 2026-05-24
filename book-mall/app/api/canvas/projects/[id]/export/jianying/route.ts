import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { CanvasProjectError, getCanvasProjectForUser } from "@/lib/canvas/canvas-project-service";
import {
  buildJianyingDraftZip,
  buildStoryBundleZip,
  type JianyingFrameInput,
} from "@/lib/canvas/canvas-jianying-export";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id: projectId } = await ctx.params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const format = body.body.format === "draft" ? "draft" : "bundle";
  const frames = body.body.frames as JianyingFrameInput[] | undefined;
  if (!Array.isArray(frames) || frames.length === 0) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "body.frames required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }

  try {
    const project = await getCanvasProjectForUser(guard.user.id, projectId);
    const buf =
      format === "draft"
        ? await buildJianyingDraftZip(frames, project.name)
        : await buildStoryBundleZip(frames);

    const filename =
      format === "draft"
        ? `jianying-draft-${projectId.slice(0, 8)}.zip`
        : `story-bundle-${projectId.slice(0, 8)}.zip`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        ...jsonHeaders(request),
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof CanvasProjectError) {
      return canvasErrorToResponse(request, err);
    }
    return canvasErrorToResponse(request, err);
  }
}
