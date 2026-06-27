"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  adminCreateEngineModel,
  adminPatchEngineModel,
  listCanvasEngineModels,
  type CanvasEngineModel,
} from "@/lib/canvas-api";
import { fetchCanvasViewerUser, type CanvasViewerUser } from "@/lib/canvas-viewer-session";

type AddForm = {
  modelKey: string;
  displayName: string;
  vendor: string;
  role: "IMAGE" | "VIDEO" | "LLM";
  description: string;
  defaultParams: string;
};

const EMPTY_ADD: AddForm = {
  modelKey: "",
  displayName: "",
  vendor: "",
  role: "IMAGE",
  description: "",
  defaultParams: "{}",
};

function Inner() {
  const base = useBookMallBaseUrl();
  const [user, setUser] = useState<CanvasViewerUser | null>(null);
  const [models, setModels] = useState<CanvasEngineModel[]>([]);
  const [builtin, setBuiltin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const u = await fetchCanvasViewerUser(base);
      setUser(u);
      const r = await listCanvasEngineModels(base);
      setModels(r.models);
      setBuiltin(!!r.builtinFallback);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = user?.role === "admin";

  const onOpenAdd = useCallback(() => {
    setAddForm(EMPTY_ADD);
    setAddError(null);
    setAddOpen(true);
  }, []);

  const onSubmitAdd = useCallback(async () => {
    if (!base) return;
    if (!addForm.modelKey.trim() || !addForm.displayName.trim() || !addForm.vendor.trim()) {
      setAddError("modelKey / displayName / vendor 不能为空");
      return;
    }
    let defaults: Record<string, unknown> | undefined;
    if (addForm.defaultParams.trim()) {
      try {
        defaults = JSON.parse(addForm.defaultParams);
        if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
          throw new Error("defaultParams 必须是 JSON 对象");
        }
      } catch (e) {
        setAddError(`defaultParams 解析失败：${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
    setSubmitting(true);
    setAddError(null);
    try {
      await adminCreateEngineModel(base, {
        modelKey: addForm.modelKey.trim(),
        displayName: addForm.displayName.trim(),
        vendor: addForm.vendor.trim(),
        role: addForm.role,
        description: addForm.description.trim() || undefined,
        defaultParams: defaults,
      });
      setAddOpen(false);
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "新增失败");
    } finally {
      setSubmitting(false);
    }
  }, [base, addForm, load]);

  const onToggle = useCallback(
    async (m: CanvasEngineModel) => {
      if (!base) return;
      if (m.builtin) {
        setError("内置默认模型未在数据库；请先 admin 新增同名模型再在 DB 里禁用。");
        return;
      }
      try {
        await adminPatchEngineModel(base, { id: m.id, active: !m.active });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新失败");
      }
    },
    [base, load],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CanvasEngineModel[]>();
    for (const m of models) {
      const key = m.role || "IMAGE";
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [models]);

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="twenty-eyebrow">canvas-web · models</p>
          <h1 className="canvas-serif mt-2 text-3xl text-white">模型配置</h1>
          <p className="mt-2 text-sm text-[var(--canvas-muted)]">
            画布生成节点可选模型清单。所有模型统一走 KIE，密钥归口 book-mall。
            {builtin ? (
              <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200">
                当前为内置默认（DB 还无记录）
              </span>
            ) : null}
          </p>
        </div>
        {isAdmin ? (
          <button type="button" onClick={onOpenAdd} className="twenty-btn-accent">
            <Plus className="mr-2 size-4" />
            新增模型
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([role, list]) => (
            <section
              key={role}
              className="overflow-hidden rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)]"
            >
              <header className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
                <p className="text-xs uppercase tracking-wider text-[var(--canvas-muted)]">
                  {role}
                </p>
                <p className="text-[11px] text-[var(--canvas-muted)]">
                  {list.length} 个
                </p>
              </header>
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--canvas-muted)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">modelKey</th>
                    <th className="px-4 py-2 font-medium">展示名</th>
                    <th className="px-4 py-2 font-medium">厂商</th>
                    <th className="px-4 py-2 font-medium">说明</th>
                    <th className="px-4 py-2 font-medium">状态</th>
                    <th className="px-4 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {list.map((m) => (
                    <tr key={m.id} className="text-white">
                      <td className="px-4 py-2.5 font-mono text-[12px]">{m.modelKey}</td>
                      <td className="px-4 py-2.5">{m.displayName}</td>
                      <td className="px-4 py-2.5 text-[var(--canvas-muted)]">{m.vendor}</td>
                      <td className="max-w-[20rem] px-4 py-2.5 text-[12px] text-[var(--canvas-muted)]">
                        {m.description ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.active ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                            启用
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] text-zinc-300">
                            禁用
                          </span>
                        )}
                        {m.builtin ? (
                          <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">
                            内置
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => void onToggle(m)}
                            className="rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
                          >
                            {m.active ? "禁用" : "启用"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--canvas-muted)]">
                            仅 admin 可改
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {addOpen ? (
        <AddModelModal
          form={addForm}
          setForm={setAddForm}
          submitting={submitting}
          error={addError}
          onClose={() => setAddOpen(false)}
          onSubmit={onSubmitAdd}
        />
      ) : null}
    </div>
  );
}

function AddModelModal({
  form,
  setForm,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  form: AddForm;
  setForm: (next: AddForm) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface)] text-white shadow-xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-sm font-medium">新增 Canvas 模型</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-3 p-5 text-sm">
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {error}
            </p>
          ) : null}
          <Field
            label="modelKey"
            hint="KIE 模型 id，例如 nano-banana-pro / gpt-image-1 / kling-image"
            value={form.modelKey}
            onChange={(v) => setForm({ ...form, modelKey: v })}
          />
          <Field
            label="展示名"
            value={form.displayName}
            onChange={(v) => setForm({ ...form, displayName: v })}
          />
          <Field
            label="厂商"
            hint="如 google/nano-banana"
            value={form.vendor}
            onChange={(v) => setForm({ ...form, vendor: v })}
          />
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
              role
            </span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as AddForm["role"] })}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
            >
              <option value="IMAGE">IMAGE</option>
              <option value="VIDEO">VIDEO</option>
              <option value="LLM">LLM</option>
            </select>
          </label>
          <Field
            label="说明"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
          />
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
              defaultParams (JSON)
            </span>
            <textarea
              value={form.defaultParams}
              onChange={(e) => setForm({ ...form, defaultParams: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[12px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
            />
          </label>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : null}
            创建
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
      />
      {hint ? (
        <span className="mt-1 block text-[10px] text-[var(--canvas-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function ModelsClient() {
  return <Inner />;
}
