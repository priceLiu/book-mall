import type { QrTemplate, QrWorkspaceDraft } from "@/lib/qr-template-types";

export function cloneTemplateForUserSave(t: QrTemplate) {
  const title =
    t.source === "user" ? t.title : `${t.title}（副本）`.slice(0, 120);
  return {
    category: t.category,
    kind: t.kind,
    toolKey: t.toolKey,
    title,
    thumbnailUrl: t.thumbnailUrl,
    reference: t.reference,
  };
}

export async function saveCopiedTemplate(
  t: QrTemplate,
): Promise<{ template: QrTemplate } | { error: string }> {
  if (t.source === "user" && t.id) {
    return { template: t };
  }

  const payload = cloneTemplateForUserSave(t);
  const res = await fetch("/api/book-mall/api/platform/v1/quick-replica/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    template?: QrTemplate;
    error?: string;
  };
  if (!res.ok || !data.template) {
    return { error: data.error ?? `保存失败（${res.status}）` };
  }
  return { template: data.template };
}

export async function persistWorkspaceDraft(
  draft: QrWorkspaceDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!draft.savedTemplateId) {
    return { ok: false, error: "未关联已保存作品" };
  }
  const res = await fetch(
    `/api/book-mall/api/platform/v1/quick-replica/templates/${encodeURIComponent(draft.savedTemplateId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? `同步失败（${res.status}）` };
  }
  return { ok: true };
}
