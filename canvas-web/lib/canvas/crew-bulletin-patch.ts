import type { CrewBulletinAnchor } from "./crew-bulletin-context";
import { isCrewBulletinGraphMetaAnchor } from "./crew-bulletin-context";
import type { CrewBulletinState } from "./crew-bulletin-types";

export type CrewBulletinPatchStore = {
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  patchGraphMeta?: (
    updater: (
      meta: import("./types").CanvasGraph["meta"] | null | undefined,
    ) => import("./types").CanvasGraph["meta"] | null | undefined,
  ) => void;
};

export function patchCrewBulletinOnAnchor(
  anchor: CrewBulletinAnchor,
  bulletin: CrewBulletinState,
  patch: CrewBulletinPatchStore,
): void {
  if (isCrewBulletinGraphMetaAnchor(anchor)) {
    patch.patchGraphMeta?.((meta) => {
      if (!meta?.crewBulletinAnchor) return meta ?? undefined;
      return {
        ...meta,
        crewBulletinAnchor: {
          ...meta.crewBulletinAnchor,
          crewBulletin: bulletin,
        },
      };
    });
    return;
  }
  patch.updateNodeData(anchor.nodeId, { crewBulletin: bulletin });
}
