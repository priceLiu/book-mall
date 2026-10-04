import type { ComposeWorkbenchState } from "@/lib/simple-fusion-compose-workbench";
import type { MediaRenderJobDto } from "@/lib/ecom-storyboard-api";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";

/** 平台简易剪辑台 · 通用合成（Book Platform API） */
export async function renderPlatformComposeWorkbench(
  workbench: ComposeWorkbenchState,
  opts?: {
    bgmPresetId?: string;
    bgmUrl?: string;
    sourceRef?: Record<string, unknown>;
  },
): Promise<MediaRenderJobDto> {
  const data = await ecomBookFetch("api/sso/tools/media/compose/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workbench,
      bgmPresetId: opts?.bgmPresetId,
      bgmUrl: opts?.bgmUrl,
      sourceRef: opts?.sourceRef,
    }),
  });
  return data.job as MediaRenderJobDto;
}
