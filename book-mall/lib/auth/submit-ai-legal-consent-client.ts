/** 登录/补签后写入三份法律文档同意时间（须已登录） */
export async function submitAiLegalConsent(): Promise<{
  ok: boolean;
  error?: string;
  backfillCampaignActive?: boolean;
}> {
  const res = await fetch("/api/auth/legal-consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      userAgreement: true,
      appPermissions: true,
      privacyPolicy: true,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    backfillCampaignActive?: boolean;
  };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "法律文档确认失败" };
  }
  return {
    ok: true,
    backfillCampaignActive: data.backfillCampaignActive,
  };
}