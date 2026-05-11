"use client";

import Link from "next/link";
import { useToolsSession } from "@/components/tool-shell-client";

export function TextToImagePanel({
  renewHref,
  mainOrigin,
  backendReady,
  basePreview,
  model,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
  backendReady: boolean;
  basePreview: string;
  model: string;
}) {
  const { loading, session, hasTokenCookie } = useToolsSession();

  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;

  if (loading) {
    return (
      <p className="tw-muted" role="status">
        正在同步会话…
      </p>
    );
  }

  if (!session.active) {
    return (
      <div className="tw-note">
        <p style={{ margin: "0 0 0.5rem" }}>
          需要先通过主站重新连接工具站（令牌过期或未登录时会先到主站登录）。管理员可从后台「工具站」进入。
        </p>
        {renewHref ? (
          <p style={{ margin: "0 0 0.5rem" }}>
            <Link href={renewHref}>从主站重新连接工具站（返回本页）</Link>
          </p>
        ) : null}
        {originConfigured ? (
          <p className="tw-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <Link href={`${mainOrigin}/account`}>个人中心</Link>
            {" · "}
            <Link href={`${mainOrigin}/admin`}>管理后台</Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <section className="tw-card">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>开发清单</h2>
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
          <li>
            大模型 Key：在 <code>.env.local</code> 配置{" "}
            <code>TOOL_WEB_OPENAI_COMPAT_API_KEY</code>（变量名模板见{" "}
            <code>config/tool-web.env.example</code>）。
          </li>
          <li>
            可选：<code>TOOL_WEB_OPENAI_COMPAT_BASE_URL</code>、
            <code>TOOL_WEB_IMAGE_MODEL</code>（当前默认模型名：<strong>{model}</strong>
            ）。
          </li>
          <li>
            接入推理：新增例如 <code>app/api/text-to-image/route.ts</code>，仅在服务端调用上游 API。
          </li>
        </ul>
        <p style={{ marginTop: "1rem", marginBottom: 0 }}>
          <strong>后端配置状态：</strong>
          {backendReady ? (
            <span>已检测到 Key，可以开始接线</span>
          ) : (
            <span>尚未配置 Key</span>
          )}
          <span className="tw-muted">
            {" "}
            · Base URL 预览：{basePreview}
          </span>
        </p>
      </section>

      <section className="tw-card" aria-hidden={false}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>生成区（占位）</h2>
        <p className="tw-muted">
          下一步：在此挂载客户端表单（prompt / 尺寸），请求本站{" "}
          <code>/api/...</code>；成功后再替换下方占位文案。
        </p>
        <div
          style={{
            marginTop: "1rem",
            minHeight: "12rem",
            borderRadius: "10px",
            border: "2px dashed #eaeaea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888888",
            fontSize: "0.95rem",
          }}
        >
          预览画布占位
        </div>
      </section>
    </>
  );
}
