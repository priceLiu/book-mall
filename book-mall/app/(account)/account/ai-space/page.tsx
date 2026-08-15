import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AiSpaceAudioLibrary } from "@/components/ai-space/ai-space-audio-library";
import { AiSpaceComposeDesk } from "@/components/ai-space/ai-space-compose-desk";
import { AiSpaceDigitalHumanLibrary } from "@/components/ai-space/ai-space-digital-human-library";
import { AiSpacePinWall } from "@/components/ai-space/ai-space-pin-wall";
import { AiSpaceTabNav } from "@/components/ai-space/ai-space-tab-nav";
import { AiSpaceVideoLibrary } from "@/components/ai-space/ai-space-video-library";
import { listAiSpaceAudioAssets } from "@/lib/ai-space/ai-space-audio-service";
import { listAiSpaceDigitalHumans } from "@/lib/ai-space/ai-space-digital-human-service";
import { listAiSpaceComposeTasks } from "@/lib/ai-space/ai-space-compose-query";
import {
  listAiSpaceVideoLibrary,
  listAiSpaceVideoMaterials,
} from "@/lib/ai-space/ai-space-video-material-service";
import { listPins } from "@/lib/ai-space/ai-space-pin-service";
import { normalizeAiSpaceTab } from "@/lib/ai-space/ai-space-tabs";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的 AI 空间 — 个人中心",
};

const TAB_DESCRIPTION: Record<string, string> = {
  wall: "各应用已发布的作品在此布置展示。空间只保存指向原作品的链接，不复制文件；删除原作品会一并移除这里的展示。",
  "digital-humans": "数字人形象的平台真源。上传形象后，电商、画布、Story 等应用都能直接引用同一条记录。",
  audio: "平台统一音频库。快速复刻生成的音频会自动汇入这里，也可直接上传或用 Gateway 模型生成口播。",
  videos: "可用于合成的背景与素材视频。各应用视频经作品墙引用展示，自拍与合成成片存在本库。",
  compose: "数字人口播合成：选形象 + 选音频 + 选背景，经 Gateway 生成口播视频后叠加为成片。",
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
  const audioAssets = tab === "audio" ? await listAiSpaceAudioAssets(userId) : [];
  const digitalHumans =
    tab === "digital-humans" ? await listAiSpaceDigitalHumans(userId) : [];
  const videoItems = tab === "videos" ? await listAiSpaceVideoLibrary(userId) : [];

  // 合成台需要三类素材 + 历史任务，一次性并行取
  const compose =
    tab === "compose"
      ? await Promise.all([
          listAiSpaceDigitalHumans(userId, { activeOnly: true }),
          listAiSpaceAudioAssets(userId),
          listAiSpaceVideoMaterials(userId),
          listAiSpaceComposeTasks(userId),
        ])
      : null;

  return (
    <>
      <AccountSectionHeader title="我的 AI 空间" description={TAB_DESCRIPTION[tab]} />
      <AiSpaceTabNav active={tab} />
      {tab === "wall" ? <AiSpacePinWall initialEntries={entries} /> : null}
      {tab === "digital-humans" ? (
        <AiSpaceDigitalHumanLibrary initialItems={digitalHumans} />
      ) : null}
      {tab === "audio" ? <AiSpaceAudioLibrary initialAssets={audioAssets} /> : null}
      {tab === "videos" ? <AiSpaceVideoLibrary initialItems={videoItems} /> : null}
      {tab === "compose" && compose ? (
        <AiSpaceComposeDesk
          digitalHumans={compose[0]}
          audioAssets={compose[1]}
          backgrounds={compose[2]}
          initialTasks={compose[3]}
        />
      ) : null}
    </>
  );
}
