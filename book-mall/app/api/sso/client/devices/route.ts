import { NextResponse, type NextRequest } from "next/server";
import {
  listUserClientDevices,
  revokeUserClientDevice,
} from "@/lib/client-device-service";
import { resolvePlatformUser } from "@/lib/platform-auth";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

const DEVICE_TYPE_LABEL: Record<string, string> = {
  WEB: "网页",
  EXTENSION: "浏览器扩展",
  DESKTOP: "桌面端",
};

/** GET：当前用户的已登录设备列表 */
export const GET = withApiDbGuard(async (req: NextRequest) => {
  const user = await resolvePlatformUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const devices = await listUserClientDevices(user.id);
  return NextResponse.json({
    ok: true,
    devices: devices.map((d) => ({
      id: d.id,
      deviceType: d.deviceType,
      deviceTypeLabel: DEVICE_TYPE_LABEL[d.deviceType] ?? d.deviceType,
      deviceName: d.deviceName,
      lastSeenAt: d.lastSeenAt.toISOString(),
      expiresAt: d.expiresAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
      userAgent: d.userAgent,
    })),
  });
});

/** DELETE：吊销指定设备 ?id= */
export const DELETE = withApiDbGuard(async (req: NextRequest) => {
  const user = await resolvePlatformUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const deviceId = req.nextUrl.searchParams.get("id")?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: "缺少设备 id" }, { status: 400 });
  }

  const ok = await revokeUserClientDevice(user.id, deviceId);
  if (!ok) {
    return NextResponse.json({ error: "设备不存在或已吊销" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
