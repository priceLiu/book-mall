import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { FittingRoomPanel } from "./fitting-room-panel";

export const metadata = {
  title: "试衣间 — AI 工具站",
};

export default function FittingRoomPage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/fitting-room");

  return (
    <main className="tw-main">
      <h1 style={{ marginTop: 0 }}>试衣间</h1>
      <p className="tw-muted">
        独立工具应用页面骨架：可在此接入试衣推理、素材管理与计费埋点；顶栏与会话卡片通过客户端{" "}
        <code>/api/tools-session</code> 同步（配置 <code>TOOLS_SSO_JWT_SECRET</code> 时为 JWT
        快路径）；计费与强校验请在 API Route 内调用主站 <code>introspect</code>。
      </p>

      <FittingRoomPanel renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
