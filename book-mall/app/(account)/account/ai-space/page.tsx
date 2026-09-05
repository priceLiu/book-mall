import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AiSpaceAssetLibraryDesk } from "@/components/ai-space/ai-space-asset-library-desk";
import { AiSpaceAudioLibrary } from "@/components/ai-space/ai-space-audio-library";
import { AiSpaceBroadcastDesk } from "@/components/ai-space/ai-space-broadcast-desk";
import { AiSpaceComposeDeskLoader } from "@/components/ai-space/ai-space-compose-desk-loader";
import { AiSpaceComposeTasksDesk } from "@/components/ai-space/ai-space-compose-tasks-desk";
import { AiSpaceDigitalHumanLibrary } from "@/components/ai-space/ai-space-digital-human-library";
import { AiSpaceFavoritesDesk } from "@/components/ai-space/ai-space-favorites-desk";
import { SpaceCanvasEditor } from "@/components/ai-space/space-canvas/space-canvas-editor";
import { AiSpaceUploadsDesk } from "@/components/ai-space/ai-space-uploads-desk";
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
import { getSpacePageForOwner } from "@/lib/ai-space/ai-space-space-service";
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
  // 作品墙 = 自由画布：页与块一次读全，素材抽屉读 Pin
  const wall =
    tab === "wall"
      ? await Promise.all([getSpacePageForOwner(userId), listPins(userId)])
      : null;
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
      {tab === "wall" && wall ? (
        <SpaceCanvasEditor initialPage={wall[0]} initialPins={wall[1]} />
      ) : null}
      {/* 资产库全客户端拉取：14 个源的聚合扫描不该拖慢首屏 RSC */}
      {tab === "library" ? <AiSpaceAssetLibraryDesk /> : null}
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
      {/* 合成台选材同样全客户端拉取：5 条 SQL 不该卡住整页导航 */}
      {tab === "compose" ? <AiSpaceComposeDeskLoader /> : null}
      {tab === "compose-tasks" ? <AiSpaceComposeTasksDesk /> : null}
      {tab === "uploads" ? <AiSpaceUploadsDesk /> : null}
    </>
  );
}
