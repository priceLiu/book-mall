"use client";

import { useCallback, useEffect, useState } from "react";

type PoseRow = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  ossUrl?: string | null;
};

type ModelRow = {
  id: string;
  name: string;
  ossUrl?: string | null;
};

type Props = {
  open: boolean;
  poses: PoseRow[];
  onClose: () => void;
  onDone: () => void;
};

export function AdminPoseLibraryGenerateStudio({ open, poses, onClose, onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelCatalogId, setModelCatalogId] = useState("");
  const [garmentOssUrl, setGarmentOssUrl] = useState("");
  const [garmentDescription, setGarmentDescription] = useState("");
  const [sceneText, setSceneText] = useState("浅灰摄影棚背景，均匀柔光");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    Array<{ poseId: string; ok: boolean; error?: string }>
  >([]);

  const loadModels = useCallback(async () => {
    const res = await fetch("/api/admin/ecom/model-library/models");
    const data = (await res.json()) as { models?: ModelRow[] };
    setModels(data.models ?? []);
    if (data.models?.[0]?.id) setModelCatalogId(data.models[0].id);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadModels();
    setSelected(new Set());
    setResults([]);
  }, [open, loadModels]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0 || !modelCatalogId) return;
    setBusy(true);
    setResults([]);
    try {
      const res = await fetch("/api/admin/ecom/pose-library/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poseIds: [...selected],
          modelCatalogId,
          garmentOssUrl: garmentOssUrl.trim() || undefined,
          garmentDescription: garmentDescription.trim() || undefined,
          sceneText: sceneText.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        results?: Array<{ poseId: string; ok: boolean; error?: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setResults(data.results ?? []);
      onDone();
    } catch (e) {
      setResults([
        {
          poseId: "—",
          ok: false,
          error: e instanceof Error ? e.message : "生成失败",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-4 py-3">
          <h4 className="font-semibold">生成姿势参考图</h4>
          <p className="text-xs text-muted-foreground">选择姿势、模特与可选服装，批量生成参考图。</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          <section>
            <p className="mb-2 font-medium">选择姿势（可多选）</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
              {poses.map((p) => (
                <label key={p.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span>
                    <span className="font-medium">{p.title}</span>
                    <span className="text-muted-foreground"> · {p.category}</span>
                    {p.ossUrl ? (
                      <span className="ml-1 text-[#0969da]">已有图</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>
          <label className="block space-y-1">
            <span className="font-medium">模特</span>
            <select
              className="w-full rounded border px-2 py-1"
              value={modelCatalogId}
              onChange={(e) => setModelCatalogId(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">服装参考图 URL（可选）</span>
            <input
              className="w-full rounded border px-2 py-1"
              value={garmentOssUrl}
              onChange={(e) => setGarmentOssUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">服装描述（可选）</span>
            <input
              className="w-full rounded border px-2 py-1"
              value={garmentDescription}
              onChange={(e) => setGarmentDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">场景</span>
            <input
              className="w-full rounded border px-2 py-1"
              value={sceneText}
              onChange={(e) => setSceneText(e.target.value)}
            />
          </label>
          {results.length > 0 ? (
            <ul className="space-y-1 rounded border bg-muted/20 p-2">
              {results.map((r) => (
                <li key={r.poseId} className={r.ok ? "text-green-700" : "text-red-600"}>
                  {r.poseId}: {r.ok ? "成功" : r.error ?? "失败"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button type="button" className="rounded border px-3 py-1" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="rounded bg-[#0969da] px-3 py-1 text-white disabled:opacity-50"
            disabled={busy || selected.size === 0 || !modelCatalogId}
            onClick={() => void submit()}
          >
            {busy ? "生成中…" : `生成 (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
