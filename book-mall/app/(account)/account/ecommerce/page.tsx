import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import { getEcommerceWebOrigin } from "@/lib/app-web-origins";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
import { getUserEcomBillingMode } from "@/lib/ecom/ecom-billing-mode";
import { AccountEcommerceCard } from "@/components/account/account-ecommerce-card";
import { AccountSectionHeader } from "@/components/account/account-section-header";

export const metadata = {
  title: "电商工具箱 — 个人中心",
};

export default async function AccountEcommercePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [ecomAccess, ecomBillingMode] = await Promise.all([
    userCanAccessEcommerceToolkit(session.user.id),
    getUserEcomBillingMode(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const ecomOriginConfigured = Boolean(getEcommerceWebOrigin().startsWith("http"));
  const canLaunchEcommerce =
    toolsSsoReady && (isAdminUser || ecomAccess);

  return (
    <>
      <AccountSectionHeader
        title="电商工具箱"
        description="主图、详情、带货视频与品牌 VI；支持代付按次或月费 + 自备 Gateway Key。"
      />
      <AccountEcommerceCard
        canLaunch={canLaunchEcommerce}
        originConfigured={ecomOriginConfigured}
        ecomBillingMode={ecomBillingMode}
      />
    </>
  );
}
