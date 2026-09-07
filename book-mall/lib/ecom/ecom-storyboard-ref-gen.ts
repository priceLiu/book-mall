import { randomUUID } from "crypto";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import { requireStoryboardProductRef } from "@/lib/ecom/ecom-storyboard-refs";
import {
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
  type EcomStoryboardProjectDto,
} from "@/lib/ecom/ecom-storyboard-service";
import {
  ECOM_STORYBOARD_REF_GENERATE_ACTION,
  ECOM_STORYBOARD_TOOL_KEY,
  type StoryboardReference,
} from "@/lib/ecom/ecom-storyboard-types";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

export type StoryboardRefGenerateRole = "character" | "scene";

const ROLE_RATIO: Record<StoryboardRefGenerateRole, EcomImageRatio> = {
  character: "3:4",
  scene: "16:9",
};

const ROLE_LABEL: Record<StoryboardRefGenerateRole, string> = {
  character: "AI 模特",
  scene: "AI 场景",
};

export async function generateStoryboardReferenceImage(opts: {
  userId: string;
  projectId: string;
  role: StoryboardRefGenerateRole;
  prompt: string;
  modelKey?: string;
}): Promise<{ reference: StoryboardReference; project: EcomStoryboardProjectDto }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("请填写生图 Prompt");

  const project = await getEcomStoryboardProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const wf = project.meta?.workflow ?? {};
  const settingsImageKey =
    project.settings &&
    typeof project.settings.imageModelKey === "string"
      ? project.settings.imageModelKey.trim()
      : "";
  const modelKey =
    opts.modelKey?.trim() ||
    (typeof wf.imageModelKey === "string" ? wf.imageModelKey.trim() : "") ||
    settingsImageKey ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  const refImageUrls: string[] = [];
  if (opts.role === "character") {
    const productRef = requireStoryboardProductRef(project.references);
    refImageUrls.push(productRef.ossUrl.trim());
  }

  const ossUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio: ROLE_RATIO[opts.role],
    refImageUrls,
    toolKey: `${ECOM_STORYBOARD_TOOL_KEY}__${ECOM_STORYBOARD_REF_GENERATE_ACTION}`,
  });

  const reference: StoryboardReference = {
    id: randomUUID(),
    label: ROLE_LABEL[opts.role],
    role: opts.role,
    ossUrl,
  };

  const refs = project.references.filter((r) => r.role !== opts.role);
  refs.push(reference);

  const updated = await updateEcomStoryboardProject(opts.userId, opts.projectId, {
    references: refs,
  });
  if (!updated) throw new Error("项目不存在");

  return { reference, project: updated };
}
