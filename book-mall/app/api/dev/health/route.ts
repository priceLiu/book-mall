import { NextResponse } from "next/server";
import {
  getDevHubServices,
  probeServiceUrl,
} from "@/lib/dev-hub-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 开发环境：探测各子站是否已启动（服务端 fetch，无浏览器 CORS 限制） */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const services = getDevHubServices();
  const results = await Promise.all(
    services.map(async (s) => {
      const probe = await probeServiceUrl(s.url);
      return {
        id: s.id,
        url: s.url,
        up: probe.up,
        status: probe.status ?? null,
        error: probe.error ?? null,
      };
    }),
  );

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services: results,
  });
}
