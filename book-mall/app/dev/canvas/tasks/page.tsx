import { notFound } from "next/navigation";
import { CanvasTasksClient } from "./canvas-tasks-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "画布 KIE 任务 · /dev" };

export default function DevCanvasTasksPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <CanvasTasksClient />;
}
