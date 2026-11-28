import {
  consumeCredits,
  getAccountCreditBalances,
  InsufficientCreditsError,
  refundCredits,
  spendableCreditBalance,
  type AccountRef,
} from "@/lib/billing/credit-account-service";
import { resolveGenerationBillingOwnerRef } from "@/lib/billing/credit-pre-check";
import { IMAGE_EDITOR_COLOR_GRADE_CREDITS } from "@/lib/ecom/image-editor-color-grade-credits";

export type ImageEditorColorGradeCharge = {
  ref: AccountRef;
  credits: number;
  /** 流水 id，给前端结算提示去重。 */
  chargeId: string;
};

export async function chargeImageEditorColorGrade(input: {
  userId: string;
  chargeId: string;
  gradeId: string;
}): Promise<ImageEditorColorGradeCharge> {
  const credits = IMAGE_EDITOR_COLOR_GRADE_CREDITS;
  const { ref } = await resolveGenerationBillingOwnerRef({
    actorBookUserId: input.userId,
    minNeeded: credits,
  });
  const snap = await getAccountCreditBalances(ref);
  const spendable = spendableCreditBalance(snap);
  if (spendable < credits) {
    throw new InsufficientCreditsError(spendable, credits);
  }
  const res = await consumeCredits({
    ref,
    credits,
    actorUserId: input.userId,
    idempotencyKey: `ecom_color_grade:${input.chargeId}`,
    description: `图片编辑调色 · ${input.gradeId}`,
  });
  const ledgerId = res.ledger?.id?.trim() ?? "";
  if (!ledgerId) throw new Error("调色扣积分失败");
  return { ref, credits, chargeId: ledgerId };
}

export async function refundImageEditorColorGrade(billed: ImageEditorColorGradeCharge): Promise<void> {
  await refundCredits({
    ref: billed.ref,
    credits: billed.credits,
    idempotencyKey: `refund:ecom_color_grade:${billed.chargeId}`,
    description: "图片编辑调色失败，退回积分",
  });
}
