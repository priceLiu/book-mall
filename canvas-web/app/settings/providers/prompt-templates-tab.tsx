"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  CANVAS_USER_PROMPT_TEMPLATE_MAX,
  createCanvasPromptTemplate,
  deleteCanvasPromptTemplate,
  getCanvasPromptTemplateUsage,
  listCanvasPromptTemplates,
  patchCanvasPromptTemplate,
  type CanvasPromptEngineKind,
  type CanvasPromptTemplateRecord,
} from "@/lib/canvas-prompt-templates-api";

type EngineSectionProps = {
  engine: CanvasPromptEngineKind;
  title: string;
  hint: string;
  templates: CanvasPromptTemplateRecord[];
  globalAtLimit: boolean;
  onReload: () => void;
};

function EngineSection({
  engine,
  title,
  hint,
  templates,
  globalAtLimit,
  onReload,
}: EngineSectionProps) {
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const builtins = templates.filter((t) => t.builtin);
  const user = templates.filter((t) => !t.builtin && !t.archived);

  const resetForm = () => {
    setName("");
    setContent("");
    setEditId(null);
    setAddOpen(false);
    setErr(null);
  };

  const openAdd = () => {
    resetForm();
    setAddOpen(true);
  };

  const openEdit = (t: CanvasPromptTemplateRecord) => {
    setEditId(t.id);
    setName(t.name);
    setContent(t.content);
    setAddOpen(true);
    setErr(null);
  };

  const onSave = async () => {
    if (!base) return;
    if (!name.trim() || !content.trim()) {
      setErr("名称与内容不能为空");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (editId) {
        await patchCanvasPromptTemplate(base, editId, {
          name: name.trim(),
          content: content.trim(),
        });
      } else {
        await createCanvasPromptTemplate(base, {
          engine,
          name: name.trim(),
          content: content.trim(),
        });
      }
      resetForm();
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (t: CanvasPromptTemplateRecord) => {
    if (!base) return;
    let usage = 0;
    try {
      usage = await getCanvasPromptTemplateUsage(base, t.id);
    } catch {
      // ignore
    }
    const usageHint =
      usage > 0
        ? `当前有 ${usage} 个画布节点仍记录此模板来源；节点内已拷贝的 prompt 不受影响。`
        : "尚无画布节点记录此模板来源。";

    const ok = await dialogs.doubleConfirm({
      first: {
        title: `归档模板「${t.name}」？`,
        message: `将从可选用列表移除，并释放 1 条配额。${usageHint}`,
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 归档不可撤销",
        message:
          "归档后无法在新建节点里选用，但 name/content 快照会保留；已拷贝到画布的 prompt 不会丢失。",
        confirmLabel: "确认归档",
        danger: true,
      },
    });
    if (!ok) return;
    try {
      await deleteCanvasPromptTemplate(base, t.id);
      onReload();
    } catch (e) {
      await dialogs.alert({
        title: "归档失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  };

  return (
    <section className="rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white">{title}</h2>
          <p className="mt-1 text-sm text-[var(--canvas-muted)]">{hint}</p>
          <p className="mt-1 text-[11px] text-white/40">
            系统内置 {builtins.length} 条 · 本节活跃 {user.length} 条
          </p>
        </div>
        <button
          type="button"
          disabled={globalAtLimit || addOpen}
          onClick={openAdd}
          className="twenty-btn-accent text-sm disabled:opacity-50"
          title={
            globalAtLimit
              ? `已达全局上限 ${CANVAS_USER_PROMPT_TEMPLATE_MAX} 条`
              : undefined
          }
        >
          <Plus className="mr-1 size-4" />
          添加模板
        </button>
      </div>

      {builtins.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-white/40">
            系统内置（只读）
          </p>
          {builtins.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--canvas-accent)]/25 px-1.5 py-0.5 text-[10px] text-white">
                  系统
                </span>
                <span className="font-medium text-white">{t.name}</span>
              </div>
              {t.description ? (
                <p className="mt-1 text-[11px] text-white/50">{t.description}</p>
              ) : null}
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/65">
                {t.content}
              </pre>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          我的模板（活跃）
        </p>
        {user.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-[var(--canvas-muted)]">
            本节还没有自定义模板。
          </p>
        ) : (
          user.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{t.name}</p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/60">
                  {t.content}
                </pre>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="rounded-md border border-white/10 p-1.5 text-white/70 hover:text-white"
                  title="编辑"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(t)}
                  className="rounded-md border border-red-400/30 p-1.5 text-red-300 hover:bg-red-500/10"
                  title="归档"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {addOpen ? (
        <div className="mt-4 rounded-lg border border-[var(--canvas-accent)]/30 bg-black/30 p-4">
          <p className="mb-3 text-sm font-medium text-white">
            {editId ? "编辑模板" : "新建模板"}
          </p>
          <label className="block text-[11px] text-white/60">名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
            placeholder="例如：电商详情页 · 风格化"
          />
          <label className="mt-3 block text-[11px] text-white/60">提示词内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="mt-1 w-full resize-y rounded-md border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[12px] leading-relaxed text-white"
            placeholder="完整 prompt 正文…"
          />
          {err ? <p className="mt-2 text-[11px] text-red-300">{err}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/80"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSave()}
              className="rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ArchivedSection({ templates }: { templates: CanvasPromptTemplateRecord[] }) {
  const archived = templates.filter((t) => !t.builtin && t.archived);
  if (archived.length === 0) return null;

  return (
    <section className="rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-5">
      <h2 className="text-lg font-medium text-white">已归档模板（只读快照）</h2>
      <p className="mt-1 text-sm text-[var(--canvas-muted)]">
        归档后不可再选用，但保留删除时的 name/content，供追溯；不占用活跃配额。
      </p>
      <div className="mt-4 space-y-2">
        {archived.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 opacity-80"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                {t.engine}
              </span>
              <span className="font-medium text-white/80">{t.name}</span>
              {t.deletedAt ? (
                <span className="text-[10px] text-white/35">
                  归档于 {new Date(t.deletedAt).toLocaleString("zh-CN")}
                </span>
              ) : null}
            </div>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/50">
              {t.content}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PromptTemplatesTab() {
  const base = useBookMallBaseUrl();
  const [templates, setTemplates] = useState<CanvasPromptTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const list = await listCanvasPromptTemplates(base, undefined, {
        includeArchived: true,
      });
      setTemplates(list);
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

  const activeUserCount = useMemo(
    () => templates.filter((t) => !t.builtin && !t.archived).length,
    [templates],
  );
  const globalAtLimit = activeUserCount >= CANVAS_USER_PROMPT_TEMPLATE_MAX;

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
        <Loader2 className="size-4 animate-spin" />
        加载提示词模板…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      <p className="text-sm text-[var(--canvas-muted)]">
        画布节点通过「插入提示词模板」选用。自定义模板{" "}
        <strong className="font-medium text-white">
          LLM + IMAGE 合计最多 {CANVAS_USER_PROMPT_TEMPLATE_MAX} 条活跃
        </strong>
        （当前 {activeUserCount}/{CANVAS_USER_PROMPT_TEMPLATE_MAX}），引擎比例自行分配；系统内置不占配额。
      </p>
      <EngineSection
        engine="LLM"
        title="AI 引擎 · 提示词模板"
        hint="用于 LLM 多模态分析（产品图 + 风格图 → 英文生图 prompt 等）。"
        templates={templates.filter((t) => t.engine === "LLM")}
        globalAtLimit={globalAtLimit}
        onReload={load}
      />
      <EngineSection
        engine="IMAGE"
        title="生图引擎 · 提示词模板"
        hint="用于 image-engine 节点的英文 prompt（可直接粘贴 AI 引擎输出）。"
        templates={templates.filter((t) => t.engine === "IMAGE")}
        globalAtLimit={globalAtLimit}
        onReload={load}
      />
      <ArchivedSection templates={templates} />
    </div>
  );
}
