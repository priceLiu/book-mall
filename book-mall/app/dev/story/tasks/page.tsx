import { notFound } from "next/navigation";
import { StoryTasksClient } from "./story-tasks-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "KIE 任务 · /dev" };

export default function DevStoryTasksPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <StoryTasksClient />;
}
