import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const result = await forwardToBook("/api/auth/register", {
    method: "POST",
    body,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: (result.data.error as string) ?? "注册失败" },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
