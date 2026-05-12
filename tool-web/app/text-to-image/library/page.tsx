import { TextToImageLibraryClient } from "./image-library-client";

export const metadata = {
  title: "我的图片库 — AI 工具站",
};

export default function TextToImageLibraryPage() {
  return (
    <main className="tw-main fitting-room-main">
      <TextToImageLibraryClient />
    </main>
  );
}
