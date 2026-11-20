import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";

export default function ProjectsLoading() {
  return <CanvasListSkeleton sections={3} cardsPerSection={5} />;
}