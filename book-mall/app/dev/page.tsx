import { notFound } from "next/navigation";
import {
  getDevHubBackgroundTasks,
  getDevHubServices,
  probeServiceUrl,
} from "@/lib/dev-hub-services";
import { readDevHeartbeat } from "@/lib/dev-heartbeat";
import { DevHubClient } from "./dev-hub-client";

export const dynamic = "force-dynamic";

export default async function DevHubPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const services = getDevHubServices();
  const backgroundTasks = getDevHubBackgroundTasks();
  const checkedAt = new Date().toISOString();

  const [initialHealth, initialTaskHealth] = await Promise.all([
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
      backgroundTasks.map(async (t) => {
        const hb = await readDevHeartbeat(t.id);
        return { id: t.id, ...hb };
      }),
    ),
  ]);

  return (
    <DevHubClient
      services={services}
      backgroundTasks={backgroundTasks}
      initialHealth={initialHealth}
      initialTaskHealth={initialTaskHealth}
      checkedAt={checkedAt}
    />
  );
}
