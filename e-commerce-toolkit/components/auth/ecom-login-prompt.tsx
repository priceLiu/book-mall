"use client";

import { LogIn } from "lucide-react";

import { buildEcomLoginUrl } from "@/lib/ecom-auth";

type Props = {
  title?: string;
  message?: string;
  /** 登录成功后回到的工具站路径 */
  returnPath?: string;
};

export function EcomLoginPrompt({
  title = "需要登录",
  message = "当前未检测到有效登录会话。请通过主站 Book 账号登录后，再使用分镜策划、生图与成片功能。",
  returnPath = "/",
}: Props) {
  const loginUrl = buildEcomLoginUrl(returnPath);

  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-8">
      <div className="max-w-md rounded-2xl border border-[#e8e8ed] bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
          <LogIn className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-[#1d1d1f]">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#6e6e73]">{message}</p>
        <p className="mt-2 text-xs text-[#86868b]">
          常见原因：直接打开工具站未走主站入口、登录已过期，或 localhost 与 127.0.0.1 域名不一致。
        </p>
        <a
          href={loginUrl}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black"
        >
          <LogIn className="h-4 w-4" />
          登录
        </a>
      </div>
    </div>
  );
}
