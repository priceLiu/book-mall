import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";
import { extractProductDesignJson } from "@/lib/ecom/ecom-product-design-types";
import {
  findStep2AssistantText,
  marketingPlansLookLikeMainImages,
  parseMarketingPlansFromMarkdown,
  prepareProductDesignPatch,
} from "@/lib/ecom/ecom-product-design-marketing-parse";
import {
  buildBuyingReasonBriefFromMarkdown,
  chatHistoryHasStep3AdvanceRequest,
  coalesceBuyingReasonFromText,
  findStep3AssistantText,
  hasBuyingReasonBriefContent,
  isStep3Complete,
} from "@/lib/ecom/ecom-product-design-buying-reason-parse";
import {
  coalesceDetailOutlineFromText,
  coalesceMainImagesFromText,
  findStep1AssistantText,
  findStep4AssistantText,
  findStep7AssistantText,
  parseAnalysisFromMarkdown,
  parseDetailOutlineFromMarkdown,
  parseMainImagesFromMarkdown,
} from "@/lib/ecom/ecom-product-design-step-sync-parse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 手动重解析：助手回复里的 product-design 围栏在流式落库时若被截断，
 * 用户可在中间工作区点「重新解析」，从聊天记录中找回 Step2 营销方案。
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* 允许空 body，回落到 meta.lastAssistantRaw */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getProductDesignProject(auth.userId, id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const fallbackRaw =
      typeof body.raw === "string" && body.raw.trim()
        ? body.raw
        : typeof project.meta?.lastAssistantRaw === "string"
          ? (project.meta.lastAssistantRaw as string)
          : project.chatHistory.filter((m) => m.role === "assistant").at(-1)?.content ?? "";

    const step1Text = findStep1AssistantText(project.chatHistory, fallbackRaw);
    const step2Text = findStep2AssistantText(project.chatHistory, fallbackRaw);
    const step3Text = findStep3AssistantText(project.chatHistory, fallbackRaw);
    const step4Text = findStep4AssistantText(project.chatHistory, fallbackRaw);
    const step7Text = findStep7AssistantText(project.chatHistory, fallbackRaw);
    const jsonPatch = extractProductDesignJson(
      [step1Text, step2Text, fallbackRaw].filter(Boolean).join("\n\n"),
    );
    const mdAnalysis = parseAnalysisFromMarkdown(step1Text);
    const mdPlans = parseMarketingPlansFromMarkdown(step2Text);
    const mdReasonBrief = buildBuyingReasonBriefFromMarkdown(step3Text);
    const mdMainImages = parseMainImagesFromMarkdown(step4Text);
    const mdDetailOutline = parseDetailOutlineFromMarkdown(step7Text);

    if (
      !jsonPatch &&
      !mdAnalysis &&
      mdPlans.length === 0 &&
      !mdReasonBrief &&
      mdMainImages.length === 0 &&
      mdDetailOutline.length === 0
    ) {
      return NextResponse.json(
        { error: "未能从助手回复中解析出设计稿，请让助手重新输出对应步骤" },
        { status: 422 },
      );
    }

    const mergedMarkdown = [step1Text, step2Text, step3Text, step4Text, step7Text]
      .filter(Boolean)
      .join("\n\n---\n\n");

    let designPatch = prepareProductDesignPatch(project.design, jsonPatch ?? {}, {
      markdownText: mergedMarkdown,
    });

    if (!designPatch.analysis && mdAnalysis) {
      designPatch = { ...designPatch, analysis: mdAnalysis };
    }

    if (!designPatch.marketingPlans?.length && mdPlans.length > 0) {
      designPatch = { ...designPatch, marketingPlans: mdPlans };
    }

    const planSelected = project.design?.selectedPlanNo != null;
    const step3Advanced = chatHistoryHasStep3AdvanceRequest(project.chatHistory);
    const step3Done = isStep3Complete(project.design);
    if (planSelected && (step3Advanced || step3Done) && mdReasonBrief) {
      const coalesced = coalesceBuyingReasonFromText(
        project.design?.buyingReasonBrief,
        designPatch.buyingReasons ?? project.design?.buyingReasons,
        step3Text,
      );
      if (coalesced.brief) {
        designPatch = {
          ...designPatch,
          buyingReasonBrief: coalesced.brief,
          buyingReasons: coalesced.reasons,
        };
      }
    }

    if (planSelected && step3Done && (mdMainImages.length > 0 || step4Text.trim())) {
      const merged = coalesceMainImagesFromText(
        project.design?.mainImages,
        step4Text,
      );
      if (merged.length > 0) {
        designPatch = {
          ...designPatch,
          mainImages: merged,
        };
      }
    } else if (planSelected && mdMainImages.length > 0) {
      designPatch = {
        ...designPatch,
        mainImages: coalesceMainImagesFromText(
          project.design?.mainImages,
          step4Text,
        ),
      };
    }

    if (planSelected && mdDetailOutline.length > 0) {
      designPatch = {
        ...designPatch,
        detailOutline: coalesceDetailOutlineFromText(
          project.design?.detailOutline,
          step7Text,
        ),
      };
    }

    if (
      !designPatch.marketingPlans?.length &&
      !designPatch.buyingReasonBrief?.table?.rows?.length &&
      !hasBuyingReasonBriefContent(designPatch.buyingReasonBrief) &&
      !designPatch.mainImages?.length &&
      !designPatch.detailOutline?.length
    ) {
      return NextResponse.json(
        { error: "未能解析出可同步的结构化内容，请让助手重新输出对应步骤" },
        { status: 422 },
      );
    }

    const prevBad =
      (project.design?.marketingPlans.length ?? 0) > 0 &&
      marketingPlansLookLikeMainImages(project.design!.marketingPlans);
    const planNotSelected = project.design?.selectedPlanNo == null;

    if (prevBad && planNotSelected) {
      designPatch = {
        ...designPatch,
        buyingReasons: [],
        buyingReasonBrief: undefined,
        mainImages: [],
        detailOutline: [],
        detailPages: [],
      };
    }

    const updated = await updateProductDesignProject(auth.userId, id, { designPatch });
    return NextResponse.json({ project: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
