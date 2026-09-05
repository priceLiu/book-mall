import type { CanvasFlowNode } from "./types";

function firstHttpsUrl(
  ...candidates: (string | undefined | null)[]
): string | undefined {
  for (const raw of candidates) {
    const url = String(raw ?? "").trim();
    if (/^https:\/\//i.test(url)) return url;
  }
  return undefined;
}

function firstPlayablePreviewUrl(
  ...candidates: (string | undefined | null)[]
): string | undefined {
  for (const raw of candidates) {
    const url = String(raw ?? "").trim();
    if (!url) continue;
    if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
  }
  return undefined;
}

/** 云端自动成片 / Media Render 可拉流的 HTTPS 音频 URL */
export function resolveLibtvAudioHttpsExportUrl(
  data: {
    ossUrl?: string;
    blobUrl?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string } | null;
  },
): string | undefined {
  return firstHttpsUrl(
    data.runtime?.ossUrl,
    data.ossUrl,
    data.runtime?.ephemeralUrl,
    data.blobUrl,
  );
}

export function resolveLibtvAudioHttpsExportUrlFromNode(
  node: CanvasFlowNode,
): string | undefined {
  return resolveLibtvAudioHttpsExportUrl(
    (node.data ?? {}) as {
      ossUrl?: string;
      blobUrl?: string;
      runtime?: { ossUrl?: string; ephemeralUrl?: string };
    },
  );
}

/** 节点可试听（含 data:/blob: 本地预览） */
export function resolveLibtvAudioLocalPreviewUrl(
  data: {
    ossUrl?: string;
    blobUrl?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string } | null;
  },
): string | undefined {
  return firstPlayablePreviewUrl(
    data.runtime?.ossUrl,
    data.ossUrl,
    data.blobUrl,
    data.runtime?.ephemeralUrl,
  );
}

export type LibtvAudioMixReadiness = {
  /** 已生成且云端可混入 */
  exportReady: boolean;
  /** 画布内可试听（含尚未落 OSS 的 data:/blob:） */
  localPreview: boolean;
};

export function resolveLibtvAudioMixReadiness(
  data: {
    ossUrl?: string;
    blobUrl?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string } | null;
  },
): LibtvAudioMixReadiness {
  const exportReady = Boolean(resolveLibtvAudioHttpsExportUrl(data));
  const localPreview = Boolean(resolveLibtvAudioLocalPreviewUrl(data));
  return { exportReady, localPreview };
}
