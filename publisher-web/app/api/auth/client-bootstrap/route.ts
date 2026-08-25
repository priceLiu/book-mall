import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = (await cookies()).get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { deviceType?: string; deviceName?: string } | null = null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const result = await forwardToBook("/api/sso/client/bootstrap", {
    method: "POST",
    bearerToken: token,
    clientRequest: req,
    body: {
      deviceType: body?.deviceType ?? "WEB",
      deviceName: body?.deviceName,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: (result.data.error as string) ?? "签发失败" },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
