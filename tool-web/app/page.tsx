import Link from "next/link";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { getMainSiteOrigin } from "@/lib/site-origin";

export default function Home() {
  const origin = getMainSiteOrigin();
  const renewFitting = mainSiteToolsReEnterHref(origin, "/fitting-room");

  return (
    <main className="tw-main">
      <h1 style={{ marginTop: 0 }}>工作台</h1>
      <p className="tw-muted">
        请从左侧 <strong>工具列表</strong> 进入具体应用。大屏侧栏常驻；小屏使用左上角「菜单」展开导航。
      </p>
      <p className="tw-muted">
        若顶部显示「未建立工具站会话」，请先完成主站 SSO（个人中心 / 管理后台入口，或使用「重新连接」）。说明见{" "}
        <code>tool-web/doc/tech/sso-session-troubleshooting.md</code>。
      </p>
      {renewFitting ? (
        <div
          className="tw-note"
          style={{ marginTop: "1rem", background: "var(--tool-surface)", borderColor: "var(--tool-border)" }}
        >
          <strong>快捷：</strong>
          <Link href={renewFitting}>从主站签发会话并进入试衣间</Link>
        </div>
      ) : null}
    </main>
  );
}
