import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AiSpaceAudioLibrary } from "@/components/ai-space/ai-space-audio-library";
import { AiSpaceBroadcastDesk } from "@/components/ai-space/ai-space-broadcast-desk";
import { AiSpaceComposeDesk } from "@/components/ai-space/ai-space-compose-desk";
import { AiSpaceComposeTasksDesk } from "@/components/ai-space/ai-space-compose-tasks-desk";
import { AiSpaceDigitalHumanLibrary } from "@/components/ai-space/ai-space-digital-human-library";
import { AiSpaceFavoritesDesk } from "@/components/ai-space/ai-space-favorites-desk";
import { AiSpacePinWall } from "@/components/ai-space/ai-space-pin-wall";
import { AiSpaceVideoLibrary } from "@/components/ai-space/ai-space-video-library";
import { listAiSpaceAudioAssets } from "@/lib/ai-space/ai-space-audio-service";
import { listAiSpaceDigitalHumans } from "@/lib/ai-space/ai-space-digital-human-service";
import { listAiSpaceBroadcastProjects } from "@/lib/ai-space/ai-space-broadcast-query";
import {
  listAiSpaceVideoLibrary,
  listAiSpaceVideoMaterials,
} from "@/lib/ai-space/ai-space-video-material-service";
import {
  attachAudioFavorites,
  attachDigitalHumanFavorites,
  listAiSpaceFavorites,
} from "@/lib/ai-space/ai-space-favorite-service";
import { listPins } from "@/lib/ai-space/ai-space-pin-service";
import { normalizeAiSpaceTab } from "@/lib/ai-space/ai-space-tabs";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的 AI 空间",
};

export default async function AiSpacePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const tab = normalizeAiSpaceTab(searchParams.tab);
  const userId = session.user.id;
  const entries = tab === "wall" ? await listPins(userId) : [];
  const audioAssets =
    tab === "audio"
      ? await attachAudioFavorites(userId, await listAiSpaceAudioAssets(userId))
      : [];
  const digitalHumans =
    tab === "digital-humans"
      ? await attachDigitalHumanFavorites(userId, await listAiSpaceDigitalHumans(userId))
      : [];
  const videoItems = tab === "videos" ? await listAiSpaceVideoLibrary(userId) : [];
  const favorites = tab === "favorites" ? await listAiSpaceFavorites(userId) : [];

  const compose =
    tab === "compose"
      ? await Promise.all([
          attachDigitalHumanFavorites(
            userId,
            await listAiSpaceDigitalHumans(userId, { activeOnly: true }),
          ),
          attachAudioFavorites(userId, await listAiSpaceAudioAssets(userId)),
          listAiSpaceVideoMaterials(userId),
        ])
      : null;

  const broadcast =
    tab === "broadcast"
      ? await Promise.all([
          listAiSpaceBroadcastProjects(userId),
          listAiSpaceDigitalHumans(userId, { activeOnly: true }),
          listAiSpaceVideoMaterials(userId),
        ])
      : null;

  return (
    <>
      {tab === "wall" ? <AiSpacePinWall initialEntries={entries} /> : null}
      {tab === "digital-humans" ? (
        <AiSpaceDigitalHumanLibrary initialItems={digitalHumans} />
      ) : null}
      {tab === "audio" ? <AiSpaceAudioLibrary initialAssets={audioAssets} /> : null}
      {tab === "favorites" ? <AiSpaceFavoritesDesk initialFavorites={favorites} /> : null}
      {tab === "videos" ? <AiSpaceVideoLibrary initialItems={videoItems} /> : null}
      {tab === "broadcast" && broadcast ? (
        <AiSpaceBroadcastDesk
          initialProjects={broadcast[0]}
          digitalHumans={broadcast[1]}
          backgrounds={broadcast[2]}
        />
      ) : null}
      {tab === "compose" && compose ? (
        <AiSpaceComposeDesk
          digitalHumans={compose[0]}
          audioAssets={compose[1]}
          backgrounds={compose[2]}
        />
      ) : null}
      {tab === "compose-tasks" ? <AiSpaceComposeTasksDesk /> : null}
    </>
  );
}
