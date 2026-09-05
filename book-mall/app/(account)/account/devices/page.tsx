import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listUserClientDevices } from "@/lib/client-device-service";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { ClientDevicesPanel } from "@/components/account/client-devices-panel";

export const metadata = {
  title: "已登录设备 — 个人中心",
};

const DEVICE_TYPE_LABEL: Record<string, string> = {
  WEB: "网页",
  EXTENSION: "浏览器扩展",
  DESKTOP: "桌面端",
};

export default async function AccountDevicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const devices = await listUserClientDevices(session.user.id);

  return (
    <>
      <AccountSectionHeader
        title="已登录设备"
        description="管理一键发布扩展、桌面端与网页客户端的长效登录。"
      />
      <ClientDevicesPanel
        initialDevices={devices.map((d) => ({
          id: d.id,
          deviceType: d.deviceType,
          deviceTypeLabel: DEVICE_TYPE_LABEL[d.deviceType] ?? d.deviceType,
          deviceName: d.deviceName,
          lastSeenAt: d.lastSeenAt.toISOString(),
          expiresAt: d.expiresAt.toISOString(),
          userAgent: d.userAgent,
        }))}
      />
    </>
  );
}
