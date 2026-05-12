import { AiFitClosetClient } from "./closet-client";

export const metadata = {
  title: "我的衣柜 — AI 工具站",
};

export default function AiFitClosetPage() {
  return (
    <main className="tw-main fitting-room-main">
      <AiFitClosetClient />
    </main>
  );
}
