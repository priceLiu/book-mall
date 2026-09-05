import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";
import { ProjectsSubNav } from "@/components/layout/projects-sub-nav";

export default function ProjectsLoading() {
  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-6">
        <ProjectsSubNav align="start" className="min-w-0 max-w-full" />
      </header>
      <CanvasListSkeleton sections={1} cardsPerSection={10} />
    </div>
  );
}
