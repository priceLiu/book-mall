import type { FilmPullProject } from "@/lib/film-pull-types";
import {
  isReplicaScriptReady,
  readReplicaPhase,
} from "@/lib/media-decompose-replica-workflow";
import type { SeedVideoProject } from "@/lib/seed-video-types";

export { readReplicaPhase, isReplicaScriptReady };

export function readFilmPullProductBrief(
  project: FilmPullProject,
  seedVideo: SeedVideoProject,
): string {
  const projectMeta = project.meta as Record<string, unknown> | null | undefined;
  const seedMeta = seedVideo.meta as Record<string, unknown> | undefined;
  const fromProject =
    typeof projectMeta?.replicaProductBrief === "string"
      ? projectMeta.replicaProductBrief.trim()
      : typeof projectMeta?.productBrief === "string"
        ? projectMeta.productBrief.trim()
        : "";
  if (fromProject) return fromProject;
  const fromSeed =
    typeof seedMeta?.replicaProductBrief === "string" ? seedMeta.replicaProductBrief.trim() : "";
  return fromSeed;
}
