import { ModelCoefficientsClient } from "@/components/model-coefficients-client";

export default function AdminModelCoefficientsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[#e8e8e8] bg-white px-6 py-4">
        <h1 className="text-base font-medium text-[#262626]">模型与零售系数</h1>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          数据来自主站定价表；须在主站以管理员登录（与本站同浏览器会话）。
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <ModelCoefficientsClient />
      </div>
    </div>
  );
}
