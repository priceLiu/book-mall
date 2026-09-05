import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AdminPlatformAssistantClient } from "@/components/admin/admin-platform-assistant-client";
import { authOptions } from "@/lib/auth";
import { listRecentAiNewsDaily } from "@/lib/platform-assistant/ai-news-service";
import {
  getAssistantFeedbackSummary,
  listOpenAssistantFeedback,
} from "@/lib/platform-assistant/feedback-service";
import {
  getAssistantQaSummary,
  listAssistantQaEntries,
} from "@/lib/platform-assistant/qa-service";
import {
  getPlatformAssistantModelConfigView,
  listAssistantEmbedCandidates,
  listAssistantLlmCandidates,
} from "@/lib/platform-assistant/platform-assistant-model-config-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 小智 — 管理后台",
};

export default async function AdminPlatformAssistantPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user?.role ?? "").toUpperCase();
  if (!session?.user?.id) redirect("/login");
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect("/admin");

  const [qaItems, qaSummary, feedbackSummary, feedbackItems, aiNewsRows, config] =
    await Promise.all([
      listAssistantQaEntries(),
      getAssistantQaSummary(),
      getAssistantFeedbackSummary(),
      listOpenAssistantFeedback(50),
      listRecentAiNewsDaily(3),
      getPlatformAssistantModelConfigView(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1f2328]">AI 小智</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#656d76]">
          管理全站导览助手的<strong className="text-[#1f2328]">固定问答</strong>、
          用户反馈与模型配置。价格 / 计费 / 财务类问题仍按原有规则引导至
          <a href="/pricing" className="text-[#0969da] hover:underline">
            报价页
          </a>
          ，不可在此维护答案。
        </p>
      </div>

      <AdminPlatformAssistantClient
        qaItems={qaItems}
        qaSummary={qaSummary}
        feedbackItems={feedbackItems}
        feedbackSummary={feedbackSummary}
        modelConfig={{
          config,
          llmCandidates: listAssistantLlmCandidates(),
          embedCandidates: listAssistantEmbedCandidates(),
        }}
        aiNewsRows={aiNewsRows}
      />
    </div>
  );
}
