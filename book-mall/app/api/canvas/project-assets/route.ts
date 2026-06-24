import { type NextRequest, NextResponse } from "next/server";
import type { AssetVisibility, ProjectAssetKind } from "@prisma/client";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  createProjectAsset,
  listProjectAssets,
  ProjectAssetError,
} from "@/lib/project-asset/project-asset-service";
import type { ListProjectAssetsFilter } from "@/lib/project-asset/project-asset-types";

function parseKind(v: string | null): ProjectAssetKind | null {
  if (!v) return null;
  return v as ProjectAssetKind;
}

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const sp = request.nextUrl.searchParams;
    const filter: ListProjectAssetsFilter = {
      kind: parseKind(sp.get("kind")),
      projectId: sp.get("projectId"),
      scope: (sp.get("scope") as ListProjectAssetsFilter["scope"]) ?? "all",
      visibility: (sp.get("visibility") as AssetVisibility | "all") ?? "all",
      search: sp.get("q"),
      includeLegacy: sp.get("includeLegacy") !== "0",
    };
    const limitRaw = sp.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const cursor = sp.get("cursor")?.trim() || undefined;
    const page = await listProjectAssets(guard.user.id, filter, {
      limit,
      cursor,
    });
    return NextResponse.json(page, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof ProjectAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const asset = await createProjectAsset(guard.user.id, {
      kind: body.kind as ProjectAssetKind,
      displayName: String(body.displayName ?? ""),
      description: String(body.description ?? ""),
      thumbnailUrl: String(body.thumbnailUrl ?? ""),
      visibility: body.visibility as AssetVisibility | undefined,
      sourceProjectId: (body.sourceProjectId as string | null) ?? null,
      sourceNodeId: (body.sourceNodeId as string | null) ?? null,
      sourceEdition: (body.sourceEdition as string | null) ?? null,
      payload: (body.payload as Record<string, unknown>) ?? {},
      refs: Array.isArray(body.refs)
        ? (body.refs as Array<{
            slotKey: string;
            label?: string;
            mediaUrl: string;
            mimeType?: string | null;
            meta?: Record<string, unknown> | null;
            sortOrder?: number;
          }>)
        : [],
    });
    return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
  } catch (err) {
    if (err instanceof ProjectAssetError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.httpStatus, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
