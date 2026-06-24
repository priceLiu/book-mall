"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type MarketDetailResponse,
  type MarketHistoryItem,
  type PlaygroundField,
  type PlaygroundSchema,
} from "@/lib/market-types";

type Tab = "playground" | "examples" | "readme";

type Props = {
  canonicalKey: string;
  initial: MarketDetailResponse;
};

function defaultValues(schema: PlaygroundSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
    else if (f.type === "image-urls") out[f.key] = [];
    else out[f.key] = "";
  }
  return out;
}

function FieldInput({
  field,
  value,
  onChange,
  onUpload,
}: {
  field: PlaygroundField;
  value: unknown;
  onChange: (v: unknown) => void;
  onUpload: (file: File, kind: "image" | "video") => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(kind: "image" | "video", file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUpload(file, kind);
      if (field.type === "image-urls") {
        const arr = Array.isArray(value) ? [...value] : [];
        arr.push(url);
        onChange(arr);
      } else {
        onChange(url);
      }
    } finally {
      setUploading(false);
    }
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className="gw-input min-h-[100px] resize-y font-mono text-xs"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        className="gw-input"
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <input
        className="gw-input"
        type="number"
        min={field.min}
        max={field.max}
        value={value === "" || value == null ? "" : Number(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        required={field.required}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-[var(--gw-ink)]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "image-url" || field.type === "video-url") {
    const kind = field.type === "video-url" ? "video" : "image";
    return (
      <div className="space-y-2">
        <input
          className="gw-input font-mono text-xs"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… 或上传文件"
          required={field.required}
        />
        <div className="flex items-center gap-2">
          <label className="gw-btn-ghost cursor-pointer text-xs">
            {uploading ? "上传中…" : "上传文件"}
            <input
              type="file"
              className="hidden"
              accept={kind === "video" ? "video/*" : "image/*"}
              onChange={(e) => void handleFile(kind, e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {typeof value === "string" && value ? (
          kind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={value} controls className="max-h-40 rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-40 rounded-lg object-contain" />
          )
        ) : null}
      </div>
    );
  }

  if (field.type === "image-urls") {
    const urls = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        <textarea
          className="gw-input min-h-[60px] font-mono text-xs"
          value={urls.join("\n")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="每行一个 URL"
        />
        <label className="gw-btn-ghost inline-flex cursor-pointer text-xs">
          {uploading ? "上传中…" : "追加图片"}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => void handleFile("image", e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    );
  }

  return (
    <input
      className="gw-input"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function HistoryGrid({ items }: { items: MarketHistoryItem[] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-[var(--gw-muted)]">暂无成功运行的记录。Run 一次后这里会显示最近 8 条。</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.logId}
          className="overflow-hidden rounded-lg border border-[var(--gw-border)] bg-black/30"
        >
          <div className="relative aspect-square bg-black/50">
            {item.mediaKind === "video" && item.previewUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={item.previewUrl}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
            ) : item.mediaKind === "image" && item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-[var(--gw-muted)]">
                {item.mediaKind === "text" ? "Chat" : "—"}
              </div>
            )}
          </div>
          <div className="px-2 py-1.5 text-[10px] text-[var(--gw-muted)]">
            {new Date(item.submittedAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketPlaygroundClient({ canonicalKey, initial }: Props) {
  const { model, playground } = initial;
  const schema = playground.schema;
  const [tab, setTab] = useState<Tab>("playground");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [input, setInput] = useState<Record<string, unknown>>(() =>
    defaultValues(schema),
  );
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(defaultValues(schema), null, 2),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [pollStatus, setPollStatus] = useState("");
  const [output, setOutput] = useState<{
    text?: string;
    image_url?: string;
    video_url?: string;
    raw?: unknown;
  } | null>(null);
  const [history, setHistory] = useState<MarketHistoryItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(async () => {
    const qs = new URLSearchParams({
      canonicalKey,
      limit: "8",
    });
    const res = await fetch(
      `/api/book-mall/api/gateway/market/history?${qs.toString()}`,
    );
    const json = (await res.json()) as { items?: MarketHistoryItem[] };
    if (res.ok) setHistory(json.items ?? []);
  }, [canonicalKey]);

  useEffect(() => {
    void loadHistory();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadHistory]);

  const uploadFile = useCallback(async (file: File, kind: "image" | "video") => {
    const dataUrl = await readFileAsDataUrl(file);
    const res = await fetch("/api/book-mall/api/gateway/market/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, kind }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) throw new Error(json.error ?? "upload failed");
    return json.url;
  }, []);

  const parsedInput = useMemo(() => {
    if (mode === "form") return input;
    try {
      return JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [mode, input, jsonText]);

  async function onRun() {
    setError("");
    setOutput(null);
    setPollStatus("");

    if (!parsedInput) {
      setError("JSON 格式无效");
      return;
    }

    if (!model.runnable) {
      setError("当前账号无法运行此模型（请关联 Book 账号并配置凭证 / 平台代付）");
      return;
    }

    setRunning(true);
    try {
      const res = await fetch("/api/book-mall/api/gateway/market/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonicalKey, input: parsedInput }),
      });
      const created = (await res.json()) as {
        taskId?: string;
        logId?: string;
        providerKind?: string;
        error?: string;
      };
      if (!res.ok || !created.taskId) {
        throw new Error(created.error ?? "创建任务失败");
      }

      const taskId = created.taskId;
      const logId = created.logId;
      const requestKind = created.providerKind;

      setPollStatus("RUNNING");

      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts += 1;
          if (attempts > 120) {
            if (pollRef.current) clearInterval(pollRef.current);
            reject(new Error("轮询超时"));
            return;
          }
          try {
            const qs = new URLSearchParams({ taskId });
            if (logId) qs.set("logId", logId);
            if (requestKind) qs.set("requestKind", requestKind);
            const pollRes = await fetch(
              `/api/book-mall/api/gateway/market/jobs?${qs.toString()}`,
            );
            const poll = (await pollRes.json()) as {
              task_status?: string;
              text?: string;
              image_url?: string;
              video_url?: string;
              message?: string;
              raw?: unknown;
            };
            if (!pollRes.ok) throw new Error(poll.message ?? "poll failed");

            setPollStatus(poll.task_status ?? "RUNNING");

            if (poll.task_status === "SUCCEEDED") {
              if (pollRef.current) clearInterval(pollRef.current);
              setOutput({
                text: poll.text,
                image_url: poll.image_url,
                video_url: poll.video_url,
                raw: poll.raw,
              });
              void loadHistory();
              resolve();
            } else if (poll.task_status === "FAILED") {
              if (pollRef.current) clearInterval(pollRef.current);
              reject(new Error(poll.message ?? "任务失败"));
            }
          } catch (e) {
            if (pollRef.current) clearInterval(pollRef.current);
            reject(e);
          }
        }, 3000);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "运行失败");
    } finally {
      setRunning(false);
    }
  }

  function applyExample(ex: Record<string, unknown>) {
    setInput({ ...defaultValues(schema), ...ex });
    setJsonText(JSON.stringify({ ...defaultValues(schema), ...ex }, null, 2));
    setTab("playground");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/dashboard/market"
            className="text-xs text-[var(--gw-muted)] hover:text-[var(--gw-accent)]"
          >
            ← 模型市场
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--gw-ink)]">{model.displayName}</h1>
          <p className="mt-1 text-sm text-[var(--gw-muted)]">{model.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--gw-muted)]">
            <span className="rounded bg-white/5 px-2 py-0.5">{model.providerLabel}</span>
            <span className="rounded bg-white/5 px-2 py-0.5 font-mono">
              {model.activeModelKey}
            </span>
            {model.creditsPerUnit != null ? (
              <span className="rounded bg-[var(--gw-accent-muted)] px-2 py-0.5 text-[var(--gw-accent)]">
                {model.creditsPerUnit} 积分/次
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[var(--gw-border)] pb-2">
        {(
          [
            ["playground", "Playground"],
            ["examples", "Examples"],
            ["readme", "README"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-white/10 text-[var(--gw-ink)]"
                : "text-[var(--gw-muted)] hover:text-[var(--gw-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "readme" ? (
        <section className="gw-card prose prose-invert max-w-none text-sm leading-relaxed">
          <pre className="whitespace-pre-wrap font-sans text-[var(--gw-ink)]">{model.readme}</pre>
        </section>
      ) : null}

      {tab === "examples" ? (
        <section className="space-y-3">
          {(schema.examples ?? []).length === 0 ? (
            <p className="text-sm text-[var(--gw-muted)]">暂无预设示例。</p>
          ) : (
            schema.examples!.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => applyExample(ex.input)}
                className="gw-card block w-full text-left transition hover:border-orange-400/30"
              >
                <div className="text-sm font-medium text-[var(--gw-ink)]">{ex.label}</div>
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-[var(--gw-muted)]">
                  {JSON.stringify(ex.input, null, 2)}
                </pre>
              </button>
            ))
          )}
        </section>
      ) : null}

      {tab === "playground" ? (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs ${
                mode === "form" ? "bg-white/10 text-[var(--gw-ink)]" : "text-[var(--gw-muted)]"
              }`}
              onClick={() => setMode("form")}
            >
              Form
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs ${
                mode === "json" ? "bg-white/10 text-[var(--gw-ink)]" : "text-[var(--gw-muted)]"
              }`}
              onClick={() => {
                setJsonText(JSON.stringify(input, null, 2));
                setMode("json");
              }}
            >
              JSON
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="gw-card space-y-4">
              <h2>Input</h2>
              {mode === "form" ? (
                schema.fields.map((field) => (
                  <label key={field.key} className="block">
                    {field.type !== "boolean" ? (
                      <span className="mb-1 block text-xs text-[var(--gw-muted)]">
                        {field.label}
                        {field.required ? " *" : ""}
                      </span>
                    ) : null}
                    <FieldInput
                      field={field}
                      value={input[field.key]}
                      onChange={(v) =>
                        setInput((prev) => ({ ...prev, [field.key]: v }))
                      }
                      onUpload={uploadFile}
                    />
                  </label>
                ))
              ) : (
                <textarea
                  className="gw-input min-h-[280px] font-mono text-xs"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
              )}

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {pollStatus ? (
                <p className="text-xs text-[var(--gw-muted)]">Status: {pollStatus}</p>
              ) : null}

              <button
                type="button"
                className="gw-btn"
                disabled={running || !playground.supported}
                onClick={() => void onRun()}
              >
                {running ? "运行中…" : "Run"}
              </button>
              {!playground.supported ? (
                <p className="text-xs text-amber-400/90">
                  此模型暂未配置 Playground 表单，请使用 API 调试或接入文档。
                </p>
              ) : null}
            </section>

            <section className="gw-card space-y-4">
              <h2>Output</h2>
              {!output ? (
                <p className="text-sm text-[var(--gw-muted)]">运行成功后在此预览结果。</p>
              ) : (
                <div className="space-y-3">
                  {output.text ? (
                    <pre className="max-h-60 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-[var(--gw-ink)]">
                      {output.text}
                    </pre>
                  ) : null}
                  {output.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={output.image_url}
                      alt="result"
                      className="max-h-[420px] rounded-lg object-contain"
                    />
                  ) : null}
                  {output.video_url ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      src={output.video_url}
                      controls
                      className="max-h-[420px] w-full rounded-lg"
                    />
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <h2>Your runs</h2>
            <HistoryGrid items={history} />
          </section>
        </>
      ) : null}
    </div>
  );
}
