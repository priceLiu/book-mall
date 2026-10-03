import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  IP_MASTER_BENCHMARK_NEGATIVE_PROMPT,
  IP_MASTER_BENCHMARK_POSITIVE_PROMPT,
} from "@/lib/ecom/ecom-ip-master-input-presets";
import {
  getEcomIpMasterProject,
  updateEcomIpMasterProject,
  type EcomIpMasterProjectDto,
} from "@/lib/ecom/ecom-ip-master-service";
import type { IpMasterImagePrompt } from "@/lib/ecom/ecom-ip-master-template-schema";
import {
  ECOM_IP_MASTER_TOOL_KEY,
  type IpMasterReference,
} from "@/lib/ecom/ecom-ip-master-types";

export const ECOM_IP_MASTER_BENCHMARK_GENERATE_ACTION = "benchmark-generate";
export const IP_MASTER_BENCHMARK_GEN_MODEL = "wan2.7-image";

function resolveBenchmarkPrompts(project: EcomIpMasterProjectDto, override?: IpMasterImagePrompt) {
  const fromOverride = override?.positive?.trim();
  const fromWorkflow = project.meta?.workflow?.draftImagePrompt?.positive?.trim();
  const positive =
    fromOverride ||
    fromWorkflow ||
    IP_MASTER_BENCHMARK_POSITIVE_PROMPT;
  const negative =
    override?.negative?.trim() ||
    project.meta?.workflow?.draftImagePrompt?.negative?.trim() ||
    IP_MASTER_BENCHMARK_NEGATIVE_PROMPT;
  return { positive, negative };
}

export async function generateIpMasterBenchmarkImage(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
  imagePrompt?: IpMasterImagePrompt;
}): Promise<{ reference: IpMasterReference; project: EcomIpMasterProjectDto }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const project = await getEcomIpMasterProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const { positive, negative } = resolveBenchmarkPrompts(project, opts.imagePrompt);
  if (!positive.trim()) {
    throw new Error("请先生成或填写生图正向提示词");
  }

  const modelKey = opts.modelKey?.trim() || IP_MASTER_BENCHMARK_GEN_MODEL;

  const ossUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt: positive,
    negativePrompt: negative,
    ratio: "3:4",
    refImageUrls: [],
    toolKey: `${ECOM_IP_MASTER_TOOL_KEY}__${ECOM_IP_MASTER_BENCHMARK_GENERATE_ACTION}`,
    workspaceId: opts.projectId,
  });

  const reference: IpMasterReference = {
    id: `benchmark-${Date.now()}`,
    label: "AI 基准立绘",
    role: "benchmark",
    ossUrl,
  };

  await updateEcomIpMasterProject(opts.userId, opts.projectId, {
    references: [reference],
    meta: {
      workflow: {
        inputCommitted: true,
        draftImagePrompt: { positive, negative },
      },
    },
  });

  const updated = await getEcomIpMasterProject(opts.userId, opts.projectId);
  if (!updated) throw new Error("项目不存在");
  return { reference, project: updated };
}
