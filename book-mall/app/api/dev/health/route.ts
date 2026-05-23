import { NextResponse } from "next/server";
import {
  getDevHubBackgroundTasks,
  getDevHubServices,
  probeServiceUrl,
} from "@/lib/dev-hub-services";
import { readDevHeartbeat } from "@/lib/dev-heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 开发环境：探测各子站是否启动 + 后台 poll-loop 心跳。 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const services = getDevHubServices();
  const tasks = getDevHubBackgroundTasks();

  const [serviceResults, taskResults] = await Promise.all([
    Promise.all(
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
    ),
    Promise.all(
      tasks.map(async (t) => {
        const hb = await readDevHeartbeat(t.id);
        return { id: t.id, ...hb };
      }),
    ),
  ]);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services: serviceResults,
    backgroundTasks: taskResults,
  });
}
