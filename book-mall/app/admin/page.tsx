import { getPlatformCockpitSnapshot } from "@/lib/admin/platform-cockpit-service";
import { AdminPlatformCockpit } from "@/components/admin/admin-platform-cockpit";

export default async function AdminDashboardPage() {
  const snapshot = await getPlatformCockpitSnapshot();

  return <AdminPlatformCockpit data={snapshot} />;
}
