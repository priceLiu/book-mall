import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { SmartSupportChatClient } from "./smart-support-chat-client";

export const metadata = {
  title: "我的智能客服 — AI 工具站",
};

export default function SmartSupportChatPage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/smart-support/chat");

  return (
    <main className="tw-main fitting-room-main">
      <SmartSupportChatClient renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
