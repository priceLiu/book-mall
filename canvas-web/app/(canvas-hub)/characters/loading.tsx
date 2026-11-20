import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";

export default function CharactersLoading() {
  return <CanvasListSkeleton sections={1} cardsPerSection={10} />;
}