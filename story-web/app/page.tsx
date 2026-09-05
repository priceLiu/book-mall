import { ProjectsPageClient } from "@/components/projects/projects-page-client";

export const metadata = {
  title: "创作室",
  description: "管理你的 AI 漫剧项目：从故事设定到分镜生成，全流程在此开始。",
};

export default function HomePage() {
  return <ProjectsPageClient />;
}
