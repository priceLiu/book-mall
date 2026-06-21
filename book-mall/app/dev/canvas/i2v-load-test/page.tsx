import { notFound } from "next/navigation";
import { I2vLoadTestClient } from "./i2v-load-test-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "图生视频并发压测 · /dev" };

export default function DevI2vLoadTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <I2vLoadTestClient />;
}
