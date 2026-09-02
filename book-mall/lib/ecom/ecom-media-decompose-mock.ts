import {
  MOCK_REPLICA_PRODUCT_BRIEF,
  MOCK_REPLICA_SELLING_POINTS,
} from "@/lib/ecom/ecom-media-decompose-mock-fixtures";
import {
  mockMediaDecomposePatchForKind,
} from "@/lib/ecom/ecom-media-decompose-mock-fixtures";
import { listReplicaProductRefs } from "@/lib/ecom/ecom-media-decompose-replica-refs";
import {
  getEcomMediaDecomposeProject,
  saveMediaDecomposeResult,
  updateEcomMediaDecomposeProject,
} from "@/lib/ecom/ecom-media-decompose-service";
import type { MediaDecomposeProjectDto } from "@/lib/ecom/ecom-media-decompose-types";
import { extractMediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import { toMediaDecomposeDisplayContent } from "@/lib/ecom/ecom-media-decompose-structured";

/**
 * Dev mock 拆解是否可用。
 * - 生产默认关闭
 * - 开发默认开启；`ECOM_MEDIA_DECOMPOSE_MOCK=0` 强制关，`=1` 强制开
 */
export function isMediaDecomposeMockAllowed(): boolean {
  const flag = process.env.ECOM_MEDIA_DECOMPOSE_MOCK?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function buildMockRawText(structured: ReturnType<typeof mockMediaDecomposePatchForKind>): string {
  const fenced = `\`\`\`media-decompose\n${JSON.stringify(structured)}\n\`\`\``;
  return toMediaDecomposeDisplayContent(fenced);
}

/** 写入 mock 拆解结果（不调 Gateway），便于跑通后续一键复刻 */
export async function applyMockMediaDecomposeResult(
  userId: string,
  projectId: string,
  opts?: { prompt?: string },
): Promise<MediaDecomposeProjectDto> {
  if (!isMediaDecomposeMockAllowed()) {
    throw new Error("Mock 拆解未启用（仅开发环境或 ECOM_MEDIA_DECOMPOSE_MOCK=1）");
  }

  const project = await getEcomMediaDecomposeProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!project.media?.ossUrl) throw new Error("请先上传或粘贴素材");

  const structured = mockMediaDecomposePatchForKind(project.media.kind);
  const rawText = buildMockRawText(structured);
  const prompt = opts?.prompt?.trim() || project.settings.lastPrompt?.trim() || "【Mock 拆解】";

  await updateEcomMediaDecomposeProject(userId, projectId, {
    settings: { ...project.settings, lastPrompt: prompt },
  });

  return saveMediaDecomposeResult(userId, projectId, {
    rawText,
    structured,
    parseError: null,
    completedAt: new Date().toISOString(),
  });
}

/** Dev mock · 识产品（不调 Gateway） */
export async function applyMockReplicaProductRecognition(
  userId: string,
  decomposeProjectId: string,
): Promise<{
  project: MediaDecomposeProjectDto;
  seedVideo: EcomSeedVideoProjectDto;
  productBrief: string;
}> {
  if (!isMediaDecomposeMockAllowed()) {
    throw new Error("Mock 识产品未启用（仅开发环境或 ECOM_MEDIA_DECOMPOSE_MOCK=1）");
  }

  const decompose = await getEcomMediaDecomposeProject(userId, decomposeProjectId);
  if (!decompose) throw new Error("项目不存在");
  const structured =
    decompose.result?.structured ??
    (decompose.result?.rawText ? extractMediaDecomposePatch(decompose.result.rawText) : null);
  if (!structured) throw new Error("请先完成拆解");

  const seedVideoId =
    typeof decompose.meta?.replicaSeedVideoProjectId === "string"
      ? decompose.meta.replicaSeedVideoProjectId.trim()
      : "";
  if (!seedVideoId) throw new Error("请先开始一键复刻");

  const seedVideo = await getEcomSeedVideoProject(userId, seedVideoId);
  if (!seedVideo) throw new Error("复刻项目不存在");

  const productRefs = listReplicaProductRefs(seedVideo.references);
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const productBrief = MOCK_REPLICA_PRODUCT_BRIEF;
  const project = await updateEcomMediaDecomposeProject(userId, decomposeProjectId, {
    meta: {
      replicaProductBrief: productBrief,
      replicaSellingPoints: MOCK_REPLICA_SELLING_POINTS,
    },
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaCollectPhase: "ready",
      replicaProductBrief: productBrief,
      replicaSellingPoints: MOCK_REPLICA_SELLING_POINTS,
    },
  });

  return { project, seedVideo: updatedSeed, productBrief };
}
