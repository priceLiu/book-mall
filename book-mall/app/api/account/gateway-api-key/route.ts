import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import {
  getGatewayLinkStatusForUser,
  linkGatewayApiKeyForUser,
  unlinkGatewayApiKeyForUser,
} from "@/lib/canvas/book-gateway-link";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  apiKey: z.string().min(1, "请输入 sk-gw-... 密钥"),
});

function errorResponse(err: unknown) {
  if (err instanceof CanvasProjectError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.httpStatus },
    );
  }
  const msg = err instanceof Error ? err.message : "操作失败";
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const status = await getGatewayLinkStatusForUser(session.user.id);
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.apiKey?.[0] ?? "参数无效" },
      { status: 400 },
    );
  }

  try {
    const status = await linkGatewayApiKeyForUser(
      session.user.id,
      parsed.data.apiKey,
    );
    return NextResponse.json(status);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  await unlinkGatewayApiKeyForUser(session.user.id);
  return NextResponse.json({ ok: true });
}
