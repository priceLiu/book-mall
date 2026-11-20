import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  collectGenerationRecordReferenceUrls,
  isLikelyVideoUrl,
  resolveGenerationRecordPreview,
} from "@/lib/canvas/generation-record-preview";
import { extractPosterUrlFromResultPayload } from "@/lib/canvas/video-poster-ffmpeg";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/**
 * GET /api/canvas/works
 * 列出当前用户所有 SUCCEEDED 的图像类任务（即每个画布的"作品库"）。
 * 后续会增加 OutputNode 的 saveToGallery 字段做精筛。
 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const rows = await prisma.canvasGenerationTask.findMany({
      where: {
        project: { userId: guard.user.id, deletedAt: null },
        status: "SUCCEEDED",
        kind: "IMAGE",
        ossUrl: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: 200,
      select: {
        id: true,
        projectId: true,
        nodeId: true,
        model: true,
        ossUrl: true,
        ephemeralUrl: true,
        inputPayload: true,
        resultPayload: true,
        completedAt: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    });
    const works = rows.map((row) => {
      const ossUrl = row.ossUrl?.trim() ?? "";
      const posterUrl = extractPosterUrlFromResultPayload(row.resultPayload);
      const preview = resolveGenerationRecordPreview({
        ossUrl: row.ossUrl,
        ephemeralUrl: row.ephemeralUrl,
        inputPayload: row.inputPayload,
      });
      const isVideo =
        preview.previewKind === "video" || (ossUrl ? isLikelyVideoUrl(ossUrl) : false);
      const refThumb = collectGenerationRecordReferenceUrls(row.inputPayload)[0] ?? null;
      const thumbnailUrl = isVideo
        ? posterUrl ?? refThumb
        : posterUrl ?? preview.thumbnailUrl ?? (ossUrl || null);
      return {
        id: row.id,
        projectId: row.projectId,
        nodeId: row.nodeId,
        model: row.model,
        ossUrl,
        mediaKind: isVideo ? ("video" as const) : ("image" as const),
        posterUrl,
        thumbnailUrl,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        project: row.project,
      };
    });
    return NextResponse.json({ works }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
