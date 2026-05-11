import type { AiFitModelRecord } from "@/lib/ai-fit-types";
import modelsJson from "@/mock/models.json";
import { AiFitClient } from "./ai-fit-client";

export const metadata = {
  title: "AI试衣 — AI 工具站",
};

export default function AiFitPage() {
  const initialModels = modelsJson as AiFitModelRecord[];

  return (
    <main className="tw-main fitting-room-main">
      <AiFitClient initialModels={initialModels} />
    </main>
  );
}
