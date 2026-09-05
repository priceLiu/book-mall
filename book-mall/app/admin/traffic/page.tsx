import { AdminTrafficPanel } from "@/components/admin/admin-traffic-panel";
import {
  isPlatformTrafficAppKey,
  type PlatformTrafficAppKey,
} from "@/lib/site-traffic/app-keys";
import { getTrafficDashboardSnapshot } from "@/lib/site-traffic/queries";

export const metadata = {
  title: "访问统计 — 管理后台",
};

export const dynamic = "force-dynamic";

export default async function AdminTrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; app?: string }>;
}) {
  const sp = await searchParams;
  const dateCst = sp.date?.trim();
  const appRaw = sp.app?.trim() ?? "all";
  const appKey: PlatformTrafficAppKey | "all" =
    appRaw === "all" ? "all" : isPlatformTrafficAppKey(appRaw) ? appRaw : "all";

  const data = await getTrafficDashboardSnapshot({
    dateCst: dateCst && /^\d{4}-\d{2}-\d{2}$/.test(dateCst) ? dateCst : undefined,
    appKey,
  });

  return <AdminTrafficPanel data={data} selectedApp={appKey} />;
}
