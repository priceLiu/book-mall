import { VisualLabHomeClient } from "./visual-lab-home-client";

export const metadata = {
  title: "视觉实验室 — AI 工具站",
};

export default function VisualLabHomePage() {
  return (
    <main className="tw-main fitting-room-main visual-lab-main">
      <VisualLabHomeClient />
    </main>
  );
}
