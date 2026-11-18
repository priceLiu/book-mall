import type { ReactNode } from "react";

/** 标题左 · 辅助链右（登录/注册顶栏） */
export function AuthHomeV2FormHeader({
  title,
  lead,
}: {
  title: string;
  lead: ReactNode;
}) {
  return (
    <div className="auth-v2-form-header">
      <h1 className="auth-v2-headline">{title}</h1>
      <p className="auth-v2-lead auth-v2-lead-inline">{lead}</p>
    </div>
  );
}