"use client";

import Link from "next/link";

import { ECOM_MODULES } from "@/lib/modules/registry";

/** 首页 / 资产库右侧助手栏 */
export function EcomHomeAssistant({ variant }: { variant: "home" | "library" }) {
  const quick = ECOM_MODULES.filter((m) => m.href.startsWith("/ecom/")).slice(0, 6);

  return (
    <div className="flex h-full flex-col bg-[var(--ecom-assistant-surface)] p-4 text-sm">
      <p className="font-semibold text-[var(--ecom-chrome-text)]">
        {variant === "home" ? "创作助手" : "资产助手"}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ecom-chrome-text-muted)]">
        {variant === "home"
          ? "从左侧菜单选择模块，或点击下方快捷入口开始创作。"
          : "此处汇总你在各模块生成的图片与视频。删除操作需二次确认。"}
      </p>
      {variant === "home" ? (
        <ul className="mt-4 space-y-2">
          {quick.map((m) => (
            <li key={m.id}>
              <Link
                href={m.href}
                className="block rounded-lg border border-[var(--ecom-chrome-border)] bg-[var(--ecom-chrome-surface)] px-3 py-2 text-[var(--ecom-primary-on-dark)] transition-colors hover:bg-[var(--ecom-chrome-surface-raised)]"
              >
                {m.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link
          href="/"
          className="mt-4 inline-block text-[var(--ecom-primary-on-dark)] hover:underline"
        >
          ← 返回工作台
        </Link>
      )}
    </div>
  );
}
