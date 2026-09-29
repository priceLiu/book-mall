import { ProjectPageClient } from "./project-page-client";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props) {
  return { title: "漫剧项目" };
}

export default function ProjectWorkspacePage({ params }: Props) {
  const projectId = decodeURIComponent(params.id);
  return <ProjectPageClient projectId={projectId} />;
}
