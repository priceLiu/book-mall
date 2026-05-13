import { SmartSupportSessionsClient } from "./smart-support-sessions-client";

export const metadata = {
  title: "我的智能客服 — AI 工具站",
};

export default function SmartSupportSessionsPage() {
  return (
    <main className="tw-main fitting-room-main">
      <SmartSupportSessionsClient />
    </main>
  );
}
