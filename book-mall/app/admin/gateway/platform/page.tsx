import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import { getPlatformCredentialPoolStatus } from "@/lib/gateway/platform-credential-pool";
import { PlatformGatewayAdminClient } from "./platform-gateway-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPlatformGatewayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canManagePricing(session.user.role)) redirect("/admin");

  const status = await getPlatformCredentialPoolStatus();
  const credentialsUrl = encodeURIComponent("/dashboard/credentials");
  const keysUrl = encodeURIComponent("/dashboard/keys");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gateway · 平台共用凭证池</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          供<strong>平台代付</strong>用户自动托管 sk-gw 绑定；BYOK 用户不使用此池。
        </p>
      </div>
      <PlatformGatewayAdminClient
        initialStatus={status}
        gatewaySsoCredentialsUrl={`/api/sso/gateway/issue?redirect=${credentialsUrl}`}
        gatewaySsoKeysUrl={`/api/sso/gateway/issue?redirect=${keysUrl}`}
      />
    </div>
  );
}
