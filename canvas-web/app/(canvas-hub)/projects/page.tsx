import { ProjectsClient } from "./projects-client";
import { fetchProjectsListServer } from "@/lib/canvas/projects-list.server";

export const metadata = { title: "我的画布 · canvas-web" };

export default async function ProjectsPage() {
  const initialPage = await fetchProjectsListServer();
  return <ProjectsClient initialPage={initialPage} />;
}
