"use client";

import { useMemo, useState } from "react";

import { copyTextToClipboard } from "@/lib/clipboard";
import {
  GATEWAY_API_EXAMPLES,
  buildGatewayExampleCurl,
  buildGatewayExampleFetch,
  buildRecordInfoCurl,
  type GatewayApiExample,
} from "@/lib/gateway-api-examples";

function CodeBlock({
  code,
  label,
}: {
  code: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyTextToClipboard(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-[var(--gw-muted)]">{label}</p>
        <button type="button" className="gw-btn-secondary px-3 py-1 text-xs" onClick={() => void onCopy()}>
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="gw-scrollbar-thin max-h-[420px] overflow-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-[var(--gw-ink)]/90">
        {code}
      </pre>
    </div>
  );
}

function ExampleDetail({
  example,
  apiBase,
}: {
  example: GatewayApiExample;
  apiBase: string;
}) {
  const curl = useMemo(() => buildGatewayExampleCurl(apiBase, example), [apiBase, example]);
  const js = useMemo(() => buildGatewayExampleFetch(apiBase, example), [apiBase, example]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[var(--gw-muted)]">{example.summary}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--gw-muted)]">model</dt>
            <dd className="font-mono text-[var(--gw-ink)]">{example.modelKey}</dd>
          </div>
          <div>
            <dt className="text-[var(--gw-muted)]">凭证</dt>
            <dd className="text-[var(--gw-ink)]">{example.credentialLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--gw-muted)]">接口</dt>
            <dd className="font-mono text-[var(--gw-ink)]">
              {example.kind === "chat" ? "POST /chat/completions" : "POST /jobs/createTask"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--gw-muted)]">类型</dt>
            <dd className="text-[var(--gw-ink)]">{example.role}</dd>
          </div>
        </dl>
      </div>

      <CodeBlock label="cURL" code={curl} />
      <CodeBlock label="JavaScript fetch" code={js} />

      {example.notes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--gw-muted)]">
          {example.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ApiExamplesClient({ apiBase }: { apiBase: string }) {
  const [activeId, setActiveId] = useState(GATEWAY_API_EXAMPLES[0]!.id);
  const active = GATEWAY_API_EXAMPLES.find((e) => e.id === activeId) ?? GATEWAY_API_EXAMPLES[0]!;
  const pollCurl = useMemo(() => buildRecordInfoCurl(apiBase), [apiBase]);

  return (
    <div className="space-y-6">
      <section className="gw-card space-y-3">
        <h2>怎么调用</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--gw-muted)]">
          <li>
            在{" "}
            <a href="/dashboard/keys" className="text-[var(--gw-accent)] hover:underline">
              API 密钥
            </a>{" "}
            创建 <code className="text-[var(--gw-ink)]/90">sk-gw-...</code>
          </li>
          <li>把对应厂商凭证绑到这把 Key（见各示例「凭证」）。</li>
          <li>
            Base URL：<code className="text-[var(--gw-ink)]/90">{apiBase}</code>
          </li>
          <li>
            Header：<code className="text-[var(--gw-ink)]/90">Authorization: Bearer sk-gw-...</code>
          </li>
          <li>生图 / 生视频先 createTask，再用 taskId 轮询 recordInfo；对话一次返回。</li>
        </ol>
      </section>

      <div className="flex flex-wrap gap-2">
        {GATEWAY_API_EXAMPLES.map((ex) => {
          const on = ex.id === active.id;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => setActiveId(ex.id)}
              className={
                on
                  ? "rounded-full border border-[var(--gw-accent)] bg-[var(--gw-accent)]/15 px-3 py-1.5 text-sm text-[var(--gw-ink)]"
                  : "rounded-full border border-white/10 px-3 py-1.5 text-sm text-[var(--gw-muted)] hover:border-white/25 hover:text-[var(--gw-ink)]"
              }
            >
              {ex.title}
            </button>
          );
        })}
      </div>

      <section className="gw-card space-y-4">
        <h2>{active.title}</h2>
        <ExampleDetail example={active} apiBase={apiBase} />
      </section>

      <section className="gw-card space-y-3">
        <h2>查询异步任务 · recordInfo</h2>
        <p className="text-sm text-[var(--gw-muted)]">
          GPT Image / Seedance / Wan 返回 <code className="text-[var(--gw-ink)]/80">data.taskId</code>{" "}
          后轮询。对话接口不用这一步。
        </p>
        <CodeBlock label="cURL" code={pollCurl} />
        <p className="text-xs text-[var(--gw-muted)]">
          也可用 POST，JSON：<code className="text-[var(--gw-ink)]/80">{`{ "taskId": "..." }`}</code>
        </p>
      </section>
    </div>
  );
}
