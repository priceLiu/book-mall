import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canvasCorsHeaders } from "@/lib/canvas/cors";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...privateHeaders, ...canvasCorsHeaders(request) },
  });
}

export async function GET(request: NextRequest) {
  const headers = { ...privateHeaders, ...canvasCorsHeaders(request) };
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ user: null as null }, { headers });
  }
  const { id, email, name, role } = session.user;
  return NextResponse.json(
    {
      user: {
        id,
        email: email ?? null,
        name: name ?? null,
        role,
      },
    },
    { headers },
  );
}
