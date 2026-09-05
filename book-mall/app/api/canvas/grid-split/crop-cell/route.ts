import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { cropCanvasGridSplitCellToOss } from "@/lib/canvas/canvas-grid-split-crop";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** POST · 宫格单元裁切（服务端 sharp，供高清生图 img2img 参考图） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const raw = body.body as Record<string, unknown>;
  const projectId = String(raw.projectId ?? "").trim();
  const imageUrl = String(raw.imageUrl ?? "").trim();
  const cols = Number(raw.cols);
  const rows = Number(raw.rows);
  const col = Number(raw.col);
  const row = Number(raw.row);

  if (!projectId || !imageUrl.startsWith("http")) {
    return canvasErrorToResponse(
      request,
      new CanvasProjectError("INVALID_INPUT", "缺少 projectId 或 imageUrl"),
    );
  }
  if (
    !Number.isFinite(cols) ||
    !Number.isFinite(rows) ||
    !Number.isFinite(col) ||
    !Number.isFinite(row)
  ) {
    return canvasErrorToResponse(
      request,
      new CanvasProjectError("INVALID_INPUT", "宫格参数无效"),
    );
  }

  try {
    const ossUrl = await cropCanvasGridSplitCellToOss({
      projectId,
      imageUrl,
      cols,
      rows,
      col,
      row,
    });
    return NextResponse.json({ ossUrl }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
