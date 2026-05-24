import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canvasCorsHeaders } from "./cors";
import { CanvasProjectError } from "./canvas-project-service";
import { CanvasProviderError } from "./canvas-provider-service";
import { CanvasSecretError } from "./secret";
import { CanvasCharacterError } from "./canvas-character-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export function jsonHeaders(request: NextRequest): Record<string, string> {
  return { ...privateHeaders, ...canvasCorsHeaders(request) };
}

export function corsOptionsResponse(request: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: jsonHeaders(request) });
}

export type AuthorizedSessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string;
};

export type AuthGuardResult =
  | { ok: true; user: AuthorizedSessionUser }
  | { ok: false; response: NextResponse };

export async function requireSessionUser(
  request: NextRequest,
): Promise<AuthGuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: jsonHeaders(request) },
      ),
    };
  }
  return {
    ok: true,
    user: {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      role: session.user.role,
    },
  };
}

export function isAdmin(user: AuthorizedSessionUser): boolean {
  return user.role === "admin";
}

export function canvasErrorToResponse(
  request: NextRequest,
  err: unknown,
): NextResponse {
  if (err instanceof CanvasProjectError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.httpStatus, headers: jsonHeaders(request) },
    );
  }
  if (err instanceof CanvasProviderError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.httpStatus, headers: jsonHeaders(request) },
    );
  }
  if (err instanceof CanvasSecretError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: 500, headers: jsonHeaders(request) },
    );
  }
  if (err instanceof CanvasCharacterError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.httpStatus, headers: jsonHeaders(request) },
    );
  }
  console.error("[canvas-api] unexpected error", err);
  return NextResponse.json(
    { error: "INTERNAL_ERROR" },
    { status: 500, headers: jsonHeaders(request) },
  );
}

export async function readJsonBody(
  request: NextRequest,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400, headers: jsonHeaders(request) },
      ),
    };
  }
}
