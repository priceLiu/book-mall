import { ToolsMenu } from "@/components/tools-menu";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
          常用工具
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6e6e73]">
          AI 图像小工具菜单：修图、扩图、背景移除、表情包、海报等。注册送体验积分，全站
          AI 工具通用；持续使用需开通会员或充值，按次消耗积分。
        </p>
      </div>
      <ToolsMenu />
    </div>
  );
}
