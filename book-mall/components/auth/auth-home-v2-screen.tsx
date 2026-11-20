"use client";

import type { ReactNode } from "react";

import { AuthHomeV2Showcase } from "@/components/auth/auth-home-v2-showcase";
import { AuthV2Starfield } from "@/components/auth/auth-v2-starfield";

type Props = {
  children: ReactNode;
  /** 注册页右侧表单区黑底 */
  formTheme?: "light" | "dark";
};

/** 登录/注册 · 80% 卡片分屏（左单条精选成片 / 右表单） */
export function AuthHomeV2Screen({ children, formTheme = "light" }: Props) {
  const pageClass =
    formTheme === "dark" ? "auth-v2-page auth-v2-page--dark" : "auth-v2-page";

  return (
    <div className={pageClass} data-site-home-v2>
      {formTheme === "dark" ? <AuthV2Starfield /> : null}
      <div data-auth-v2-shell className="auth-v2-shell">
        <aside className="auth-v2-showcase-pane" aria-label="精选成片预览">
          <AuthHomeV2Showcase />
        </aside>
        <div className="auth-v2-form-column">
          <div className="auth-v2-form-glass-underlay" aria-hidden />
          <main className="auth-v2-form-pane" data-auth-v2-form>
            <div className="auth-v2-form-inner">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}