import { notFound } from "next/navigation";
import { GenLoadTestClient } from "./gen-load-test-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "画布生图/文本并发 · /dev" };

export default function DevGenLoadTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GenLoadTestClient />;
}
