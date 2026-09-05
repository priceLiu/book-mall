import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchToolsSession } from "@/lib/tools-introspect";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get("tools_token")?.value;
  const hadToken = Boolean(token?.trim());
  const session = await fetchToolsSession(token);
  const res = NextResponse.json(session);
  if (hadToken && !session.active) {
    res.cookies.set("tools_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
