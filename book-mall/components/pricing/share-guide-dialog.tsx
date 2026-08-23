"use client";

import { BookOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ShareGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-guide-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] min-h-[33vh] w-[clamp(320px,33vw,800px)] max-w-[min(92vw,800px)] flex-col overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-violet-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="share-guide-title"
              className="flex items-center gap-2 text-left text-lg font-semibold text-[#1f2328]"
            >
              <BookOpen className="size-5 shrink-0 text-violet-600" />
              分享与领取说明
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-[#656d76] hover:bg-[#f6f8fa]"
              aria-label="关闭"
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-left text-sm leading-relaxed text-[#656d76]">
          <div className="space-y-5">
            <section className="text-left">
              <h3 className="mb-2 text-left font-semibold text-[#1f2328]">
                一、邀请好友（8 位邀请码）
              </h3>
              <ol className="list-decimal space-y-2 pl-6 text-left [list-style-position:outside]">
                <li className="pl-1">
                  登录后进入 <strong className="text-[#1f2328]">个人中心 → 分享返佣</strong>
                  ，查看你的
                  <strong className="text-[#1f2328]"> 8 位邀请码</strong>、主站链接与微信二维码。
                </li>
                <li className="pl-1">将码、链接或二维码发给好友（微信私聊、群聊、口头报码均可）。</li>
                <li className="pl-1">
                  好友打开 <strong className="text-[#1f2328]">主站链接</strong> 或扫码，也可在主站{" "}
                  <strong className="text-[#1f2328]">/code</strong> 页手动输入邀请码。
                </li>
                <li className="pl-1">
                  好友完成注册；你在其<strong className="text-[#1f2328]">首次订阅或充值</strong>
                  后获得 20 积分。
                </li>
              </ol>
            </section>

            <section className="text-left">
              <h3 className="mb-2 text-left font-semibold text-[#1f2328]">
                二、分享工作流（10 位工作流码）
              </h3>
              <ol className="list-decimal space-y-2 pl-6 text-left [list-style-position:outside]">
                <li className="pl-1">
                  在 <strong className="text-[#1f2328]">画布 / 电商分镜 / 快速复刻</strong>
                  中打开项目或模板，点击
                  <strong className="text-[#1f2328]"> 分享工作流</strong>。
                </li>
                <li className="pl-1">
                  复制 <strong className="text-[#1f2328]">10 位码</strong>、主站链接或保存二维码，发给好友。
                </li>
                <li className="pl-1">
                  好友扫码或打开链接，在主站<strong className="text-[#1f2328]">登录</strong>
                  后自动领取一份副本，并跳转到对应应用。
                </li>
                <li className="pl-1">
                  好友<strong className="text-[#1f2328]">首次成功生成并首笔订阅或充值</strong>
                  后，你获得 40 积分。
                </li>
              </ol>
            </section>

            <section className="text-left">
              <h3 className="mb-2 text-left font-semibold text-[#1f2328]">
                三、好友如何操作（领取方）
              </h3>
              <ul className="list-disc space-y-2 pl-6 text-left [list-style-position:outside]">
                <li className="pl-1">
                  <strong className="text-[#1f2328]">邀请码</strong>：打开链接或扫码 → 注册账号（邀请关系自动关联）→
                  按需订阅或充值。
                </li>
                <li className="pl-1">
                  <strong className="text-[#1f2328]">工作流码</strong>：打开链接或扫码 → 登录（无账号可先注册）→
                  自动复制项目/模板 → 进入画布或工具开始使用。
                </li>
                <li className="pl-1">也可访问主站「兑换分享码」页，手动输入 8 位或 10 位码。</li>
              </ul>
            </section>

            <p className="text-left rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">
              同一好友按先到先得仅发一笔奖励；全部为积分，满足条件后自动到账。奖励规则详见订阅页说明。
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-violet-100 px-6 py-4">
          <Button
            type="button"
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={onClose}
          >
            知道了
          </Button>
        </div>
      </div>
    </div>
  );
}
