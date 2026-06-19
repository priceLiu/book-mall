import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { fetchToolsSessionUncachedWithDiag } from "@/lib/tools-introspect";
import {
  isToolsFederatedLogoutRequest,
  respondToolsFederatedLogout,
} from "@/lib/tools-federated-logout";

export const dynamic = "force-dynamic";

function maybeClearToolsTokenCookie(
  res: NextResponse,
  hadToken: boolean,
  active: boolean,
): void {
  if (!hadToken || active) return;
  res.cookies.set("tools_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  if (isToolsFederatedLogoutRequest(request)) {
    return respondToolsFederatedLogout(request);
  }

  const token = cookies().get("tools_token")?.value;
  const hadToken = Boolean(token?.trim());
  const { session } = await fetchToolsSessionUncachedWithDiag(token);
  const res = NextResponse.json(session);
  maybeClearToolsTokenCookie(res, hadToken, session.active);
  return res;
}
