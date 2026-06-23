import Link from "next/link";

import {
  bookAccountGatewayUrl,
  bookSsoGatewayIssueUrl,
} from "@/lib/gateway-site-urls";

const PROVIDER_ROWS = [
  {
    kind: "KIE",
    label: "KIE",
    registerHint: "kie.ai 注册并创建 API Key",
    applyUrl: "https://kie.ai/api-key",
    models: "Gemini、Nano Banana、Seedance、Flux、Kling 等",
    products: "Canvas · Story",
  },
  {
    kind: "DEEPSEEK",
    label: "DeepSeek",
    registerHint: "platform.deepseek.com 获取 API Key",
    models: "deepseek-v4-flash / v4-pro 等",
    products: "Canvas · Story · 工具站智能客服",
  },
  {
    kind: "BAILIAN",
    label: "百炼",
    registerHint: "阿里云百炼 / DashScope 控制台",
    applyUrl:
      "https://bailian.console.aliyun.com/cn-beijing?spm=5176.42028462.overview_recent.5.2124154amlfGdb&tab=model#/api-key",
    models: "wan2.6-r2v、wan2.7-r2v、happyhorse-1.0-r2v 等 R2V",
    products: "Canvas 参考生视频",
  },
  {
    kind: "DASHSCOPE",
    label: "DashScope 原生",
    registerHint: "与百炼同源 DashScope Key，路由走原生 API",
    models: "wanx 文生图、aitryon 试衣、视频实验室 i2v/t2v/r2v",
    products: "工具站",
  },
  {
    kind: "HUNYUAN",
    label: "混元 3D",
    registerHint: "腾讯云混元生 3D 控制台 sk- Key",
    models: "hunyuan-3d-pro / hunyuan-3d-express",
    products: "Canvas",
  },
] as const;

export function OperationGuideContent() {
  const bookAccount = bookAccountGatewayUrl();
  const bookSso = bookSsoGatewayIssueUrl("/dashboard");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-[var(--gw-muted)]">
          Gateway · 操作指引
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--gw-ink)]">
          从厂商 Key 到 Canvas / 工具站可用
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--gw-muted)]">
          Gateway 是<strong className="font-normal text-[var(--gw-ink)]/90">断直连</strong>
          代理层：你在各 AI 厂商注册的 API Key 只保存在 Gateway；Book / Canvas /
          工具站通过一把 <code className="text-[var(--gw-ink)]/90">sk-gw-...</code>{" "}
          调用已接入的模型，产品侧不再填写厂商 Key。
        </p>
      </header>

      <section className="gw-card space-y-4">
        <h2 className="text-lg font-medium text-[var(--gw-ink)]">一、整体关系（先看懂这个）</h2>
        <pre className="overflow-x-auto rounded-lg border border-[var(--gw-border)] bg-black/30 p-4 text-xs leading-relaxed text-[var(--gw-ink)]">
{`┌─ 你 ─────────────────────────────────────────────┐
│  1. 去 KIE / DeepSeek / 百炼 / DashScope / 混元 注册 │
│  2. Gateway「厂商凭证」填入各厂商 API Key          │
│  3. Gateway「API 密钥」创建 sk-gw，勾选要绑的凭证   │
│  4. Book 个人中心粘贴 sk-gw 完成关联               │
└──────────────────────────────────────────────────┘
                        │
                        ▼
              Canvas · Story · 工具站
              （只认 sk-gw，不经手厂商 Key）`}
        </pre>
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <strong className="text-emerald-50">不必「一个厂商一把 sk-gw」。</strong>
          推荐用<strong className="font-normal">一把 sk-gw</strong>
          同时绑定 KIE、DeepSeek、百炼等多个凭证；Book 只关联这一把即可。若需分环境或分权限，可再创建多把
          sk-gw。
        </div>
        <p className="text-sm text-[var(--gw-muted)]">
          能用的模型取决于 sk-gw <strong className="text-[var(--gw-ink)]/90">绑定了哪些厂商凭证</strong>
          ，不是 sk-gw 的数量。完整 modelKey 列表见{" "}
          <Link href="/dashboard/models" className="text-[var(--gw-accent)] hover:underline">
            接入模型
          </Link>
          （需登录）。
        </p>
      </section>

      <section className="gw-card space-y-4">
        <h2 className="text-lg font-medium text-[var(--gw-ink)]">二、五步操作（按顺序做）</h2>
        <ol className="space-y-5">
          {[
            {
              title: "注册 Book 并进入 Gateway",
              body: (
                <>
                  在 Book 注册（邮箱自动同步 Gateway 用户）。打开{" "}
                  <a
                    href={bookAccount}
                    className="text-[var(--gw-accent)] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book 个人中心 → Gateway API Key
                  </a>
                  ，点<strong className="text-[var(--gw-ink)]/90">「用 Book 账号打开 Gateway」</strong>
                  ；或 Gateway 登录页点「使用 Book 账号登录」。
                </>
              ),
            },
            {
              title: "绑定厂商凭证",
              body: (
                <>
                  进入{" "}
                  <Link
                    href="/dashboard/credentials"
                    className="text-[var(--gw-accent)] hover:underline"
                  >
                    厂商凭证
                  </Link>
                  ，按种类添加 API Key（KIE / 百炼 / DeepSeek / DashScope / 混元）。
                  每种厂商至少一条；百炼与 DashScope 若都要用，可各建一条（Key 可相同，种类不同）。
                </>
              ),
            },
            {
              title: "创建 sk-gw 并绑定凭证",
              body: (
                <>
                  进入{" "}
                  <Link href="/dashboard/keys" className="text-[var(--gw-accent)] hover:underline">
                    API 密钥
                  </Link>
                  ，新建 <code className="text-[var(--gw-ink)]/90">sk-gw-...</code>
                  ，创建时<strong className="text-[var(--gw-ink)]/90">勾选</strong>
                  要启用的厂商凭证。明文只显示一次，请妥善保存。
                </>
              ),
            },
            {
              title: "Book 关联 sk-gw",
              body: (
                <>
                  回到{" "}
                  <a
                    href={bookAccount}
                    className="text-[var(--gw-accent)] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book 个人中心
                  </a>
                  ，粘贴 sk-gw 验证。Book 只存关联 ID，不存厂商 Key 与 sk-gw 明文。
                </>
              ),
            },
            {
              title: "在产品里直接使用",
              body: (
                <>
                  打开 Canvas / Story / 工具站，选择节点或功能中的模型即可。请求经 Gateway
                  转发；未关联 sk-gw 时产品会提示先完成关联。
                </>
              ),
            },
          ].map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gw-accent)]/20 text-sm font-semibold text-[var(--gw-accent)]">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium text-[var(--gw-ink)]">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--gw-muted)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="gw-card space-y-4">
        <h2 className="text-lg font-medium text-[var(--gw-ink)]">三、厂商凭证与可用能力</h2>
        <p className="text-sm text-[var(--gw-muted)]">
          下表为常见对应关系；具体 modelKey 以「接入模型」页为准。
        </p>
        <div className="overflow-x-auto rounded-lg border border-[var(--gw-border)]">
          <table className="gw-table min-w-[640px]">
            <thead>
              <tr>
                <th>凭证种类</th>
                <th>Key 来源</th>
                <th>典型模型</th>
                <th>接入产品</th>
              </tr>
            </thead>
            <tbody className="text-[var(--gw-muted)]">
              {PROVIDER_ROWS.map((row) => (
                <tr key={row.kind}>
                  <td className="whitespace-nowrap font-medium text-[var(--gw-ink)]/90">
                    {row.label}
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--gw-muted)]">
                      {row.kind}
                    </div>
                  </td>
                  <td className="text-xs">
                    {row.registerHint}
                    {"applyUrl" in row && row.applyUrl ? (
                      <>
                        {" · "}
                        <a
                          href={row.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--gw-accent)] hover:underline"
                        >
                          申请 API Key ↗
                        </a>
                      </>
                    ) : null}
                  </td>
                  <td className="text-xs">{row.models}</td>
                  <td className="text-xs">{row.products}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gw-card space-y-4">
        <h2 className="text-lg font-medium text-[var(--gw-ink)]">四、入口速查</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--gw-border)]">
          <table className="gw-table min-w-[560px]">
            <thead>
              <tr>
                <th>做什么</th>
                <th>去哪里</th>
              </tr>
            </thead>
            <tbody className="text-sm text-[var(--gw-muted)]">
              <tr>
                <td className="text-[var(--gw-ink)]/90">Book 一键进 Gateway / 关联 sk-gw</td>
                <td>
                  <a href={bookAccount} className="text-[var(--gw-accent)] hover:underline">
                    Book 个人中心 · Gateway API Key
                  </a>
                </td>
              </tr>
              <tr>
                <td className="text-[var(--gw-ink)]/90">Book SSO 登录 Gateway</td>
                <td>
                  <a href={bookSso} className="text-[var(--gw-accent)] hover:underline">
                    使用 Book 账号登录
                  </a>
                </td>
              </tr>
              <tr>
                <td className="text-[var(--gw-ink)]/90">填厂商 API Key</td>
                <td>
                  <Link href="/dashboard/credentials" className="text-[var(--gw-accent)] hover:underline">
                    厂商凭证
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="text-[var(--gw-ink)]/90">创建 sk-gw</td>
                <td>
                  <Link href="/dashboard/keys" className="text-[var(--gw-accent)] hover:underline">
                    API 密钥
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="text-[var(--gw-ink)]/90">查看 modelKey 清单</td>
                <td>
                  <Link href="/dashboard/models" className="text-[var(--gw-accent)] hover:underline">
                    接入模型
                  </Link>
                </td>
              </tr>
              <tr>
                <td className="text-[var(--gw-ink)]/90">用量与请求日志</td>
                <td>
                  <Link href="/dashboard" className="text-[var(--gw-accent)] hover:underline">
                    用量
                  </Link>
                  {" / "}
                  <Link href="/dashboard/logs" className="text-[var(--gw-accent)] hover:underline">
                    日志
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="gw-card space-y-4">
        <h2 className="text-lg font-medium text-[var(--gw-ink)]">五、常见问题</h2>
        <dl className="space-y-4 text-sm text-[var(--gw-muted)]">
          <div>
            <dt className="font-medium text-[var(--gw-ink)]/90">
              只绑了 KIE，能用 DashScope 文生图吗？
            </dt>
            <dd className="mt-1">
              不能。需在「厂商凭证」增加 DashScope 种类，并在 sk-gw 上绑定该凭证（可仍用同一把
              sk-gw）。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--gw-ink)]/90">百炼和 DashScope 要填两次 Key 吗？</dt>
            <dd className="mt-1">
              若 Canvas 百炼 R2V 与工具站 DashScope 都要用，建议各建一条凭证（种类分别为 BAILIAN /
              DASHSCOPE）；很多情况下可以是同一个 DashScope Key。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--gw-ink)]/90">Canvas 还让用户自建 Provider 吗？</dt>
            <dd className="mt-1">
              已下线。统一走 Gateway；画布配置页仅展示 Gateway 虚拟 Provider。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--gw-ink)]/90">关联 sk-gw 失败？</dt>
            <dd className="mt-1">
              确认 sk-gw 属于当前 Book 邮箱对应的 Gateway 账号，且已绑定至少一条厂商凭证；Key
              未被撤销。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--gw-ink)]/90">在哪里看 Token / 费用？</dt>
            <dd className="mt-1">
              Gateway「用量」与「日志」。Book 个人中心只显示是否已关联、Key 前缀与已绑定厂商种类。
            </dd>
          </div>
        </dl>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-[var(--gw-border)] pt-6 text-sm">
        <Link href="/login" className="gw-btn">
          登录 Gateway
        </Link>
        <a href={bookSso} className="gw-btn-secondary">
          Book 账号登录
        </a>
        <Link href="/dashboard/docs" className="text-[var(--gw-accent)] hover:underline">
          开发者接入文档 →
        </Link>
      </footer>
    </div>
  );
}
