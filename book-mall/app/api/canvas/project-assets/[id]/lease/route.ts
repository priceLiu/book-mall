import { type NextRequest, NextResponse } from "next/server";

import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  acquireProjectAssetLease,
  heartbeatProjectAssetLease,
  ProjectAssetError,
  releaseProjectAssetLease,
} from "@/lib/project-asset/project-asset-service";

type RouteCtx = { params: { id: string } };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const parsed = await readJsonBody(request);
    const body = parsed.ok ? parsed.body : {};
    const action = String(body.action ?? "acquire");
    if (action === "heartbeat") {
      const asset = await heartbeatProjectAssetLease(guard.user.id, ctx.params.id);
      return NextResponse.json({ asset }, { headers: jsonHeaders(request) });
    }
    const force = Boolean(body.force);
    const asset = await acquireProjectAssetLease(guard.user.id, ctx.params.id, {
      force,
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

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    await releaseProjectAssetLease(guard.user.id, ctx.params.id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
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
