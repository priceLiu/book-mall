import { NextRequest, NextResponse } from "next/server";
import { canvasCorsHeaders } from "@/lib/canvas/cors";
import { resolvePlatformUser } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...privateHeaders, ...canvasCorsHeaders(request) },
  });
}

/** GET · 当前浏览者（匿名返回 null；已登录经 tools Bearer 或 NextAuth） */
export async function GET(request: NextRequest) {
  const headers = { ...privateHeaders, ...canvasCorsHeaders(request) };
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ user: null as null }, { headers });
  }

  let role = user.role;
  if (!role) {
    try {
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      role = row?.role ?? undefined;
    } catch {
      /* 不阻塞 */
    }
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role,
      },
    },
    { headers },
  );
}
