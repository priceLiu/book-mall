"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const MODELS = [
  { value: "deepseek-chat", label: "DeepSeek Chat" },
  { value: "gemini-3-flash", label: "KIE Gemini Flash" },
  { value: "qwen-plus", label: "百炼 Qwen Plus" },
];

const STORAGE_KEY = "gateway_playground_api_key";

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [message, setMessage] = useState("你好，请用一句话介绍你自己。");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setApiKey(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResponse("");
    const key = apiKey.trim();
    if (!key.startsWith("sk-gw-")) {
      setError("请粘贴完整的 sk-gw-... 密钥");
      return;
    }
    setLoading(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, key);
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: message }],
        }),
      });
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
      if (!res.ok) setError(`HTTP ${res.status}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--gw-ink)]">API 调试</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          在界面里粘贴 <code className="text-[var(--gw-ink)]/80">sk-gw-...</code>{" "}
          即可试调用，无需命令行。发送后可在{" "}
          <Link href="/dashboard/logs" className="text-[var(--gw-accent)] hover:underline">
            日志
          </Link>{" "}
          查看记录。
        </p>
      </div>

      <form onSubmit={onSubmit} className="gw-card space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-[var(--gw-muted)]">API 密钥</span>
          <input
            className="gw-input font-mono text-xs"
            type="password"
            autoComplete="off"
            placeholder="sk-gw-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
          <span className="mt-1 block text-xs text-[var(--gw-muted)]">
            仅保存在本页 sessionStorage，不会上传服务器存储。
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-[var(--gw-muted)]">模型</span>
          <select
            className="gw-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-[var(--gw-muted)]">消息</span>
          <textarea
            className="gw-input min-h-[100px] resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button type="submit" className="gw-btn" disabled={loading}>
          {loading ? "请求中…" : "发送"}
        </button>
      </form>

      {response ? (
        <section className="gw-card">
          <h2 className="mb-2 text-sm font-medium text-[var(--gw-ink)]">响应</h2>
          <pre className="max-h-[420px] overflow-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-[var(--gw-ink)]/90">
            {response}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
