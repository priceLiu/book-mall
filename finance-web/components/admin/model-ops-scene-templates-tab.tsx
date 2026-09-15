"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type TemplateModel = {
  id: string;
  canonicalModelKey: string;
  status: string;
  sortOrder: number;
};

type TemplateRow = {
  id: string;
  title: string;
  status: string;
  sortOrder: number;
  models: TemplateModel[];
};

type Bindable = {
  canonicalModelKey: string;
  displayName: string;
  activeModelKey: string | null;
  creditsPerUnit: number | null;
};

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function ModelOpsSceneTemplatesTab() {
  const base = useBookMallBaseUrl();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [bindable, setBindable] = useState<Bindable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("i2v");
  const [bindKey, setBindKey] = useState("");

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setError(null);
    const r = await financeApiFetch<{
      templates: TemplateRow[];
      bindableCanonicals: Bindable[];
    }>(base, "/api/finance/admin/scene-templates");
    if (r.ok) {
      setTemplates(r.data.templates);
      setBindable(r.data.bindableCanonicals ?? []);
      if (!selectedTemplate && r.data.templates[0]) {
        setSelectedTemplate(r.data.templates[0].id);
      }
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, selectedTemplate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function post(body: Record<string, unknown>) {
    if (!base) return;
    setBusy(true);
    setMsg(null);
    const r = await financeApiPost<{ ok: boolean; error?: string; version?: string; modelCount?: number }>(
      base,
      "/api/finance/admin/scene-templates",
      body,
    );
    setBusy(false);
    if (!r.ok || !r.data.ok) {
      setMsg(r.ok ? (r.data.error ?? "失败") : r.error);
      return;
    }
    if (body.action === "publish") {
      setMsg(`已发布 version=${r.data.version} · ${r.data.modelCount ?? 0} 条模型快照`);
    } else {
      setMsg("已保存");
    }
    await reload();
  }

  const current = templates.find((t) => t.id === selectedTemplate);

  if (loading) return <p className="text-sm text-[#8c8c8c]">加载场景模板…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#595959]">
        模板只定义<strong className="font-medium">规则</strong>（文/图/视频形态）；厂商路由在「商业上架」Tab，不写进模板。
        绑定要求：Gateway 路由 + 成本档 + 已发布积分价 + Offering ACTIVE。
      </div>

      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white disabled:opacity-50"
          onClick={() => void post({ action: "publish" })}
        >
          发布静态目录
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-[#d9d9d9] px-3 py-1.5 text-sm"
          onClick={() => void reload()}
        >
          刷新
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedTemplate(t.id)}
            className={`rounded border px-3 py-1.5 text-sm ${
              selectedTemplate === t.id
                ? "border-[#1890ff] bg-[#e6f7ff] text-[#1890ff]"
                : "border-[#d9d9d9] bg-white"
            }`}
          >
            {t.title}
            <span className="ml-1 text-xs text-[#8c8c8c]">({t.models.length})</span>
            {t.status !== "ACTIVE" ? (
              <span className="ml-1 text-xs text-amber-700">停用</span>
            ) : null}
          </button>
        ))}
      </div>

      {current ? (
        <section className="rounded border border-[#e8e8e8] bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-medium">
              {current.title} <span className="font-mono text-xs text-[#8c8c8c]">{current.id}</span>
            </h3>
            <button
              type="button"
              disabled={busy}
              className="text-sm text-[#1890ff] hover:underline"
              onClick={() =>
                void post({
                  action: "setTemplateStatus",
                  templateId: current.id,
                  status: current.status === "ACTIVE" ? "DEPRECATED" : "ACTIVE",
                })
              }
            >
              {current.status === "ACTIVE" ? "停用模板" : "启用模板"}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1 text-sm">
              <span className="text-[#8c8c8c]">绑定逻辑模型（canonical）</span>
              <select
                className={`${inputCls} mt-1 w-full`}
                value={bindKey}
                onChange={(e) => setBindKey(e.target.value)}
              >
                <option value="">选择已上架模型…</option>
                {bindable.map((b) => (
                  <option key={b.canonicalModelKey} value={b.canonicalModelKey}>
                    {b.displayName} · {b.canonicalModelKey}
                    {b.creditsPerUnit != null ? ` · ${b.creditsPerUnit} 分/单位` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !bindKey}
              className="rounded border border-[#1890ff] px-3 py-1.5 text-sm text-[#1890ff] disabled:opacity-50"
              onClick={() =>
                void post({
                  action: "bind",
                  templateId: current.id,
                  canonicalModelKey: bindKey,
                })
              }
            >
              绑定
            </button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
              <tr>
                <th className="px-2 py-1.5">canonical</th>
                <th className="px-2 py-1.5">状态</th>
                <th className="px-2 py-1.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {current.models.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-2 py-1.5 font-mono text-xs">{m.canonicalModelKey}</td>
                  <td className="px-2 py-1.5">{m.status}</td>
                  <td className="px-2 py-1.5 text-right">
                    {m.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            action: "setModelStatus",
                            templateId: current.id,
                            canonicalModelKey: m.canonicalModelKey,
                            status: "DEPRECATED",
                          })
                        }
                      >
                        解绑/停用
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-[#1890ff] hover:underline"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            action: "setModelStatus",
                            templateId: current.id,
                            canonicalModelKey: m.canonicalModelKey,
                            status: "ACTIVE",
                          })
                        }
                      >
                        恢复
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {current.models.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-2 py-6 text-center text-[#8c8c8c]">
                    尚未绑定模型
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
