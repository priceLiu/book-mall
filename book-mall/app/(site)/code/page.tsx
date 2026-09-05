import { ShareCodeInputForm } from "@/components/share/share-code-input-form";

export const metadata = {
  title: "兑换分享码 — AI Mall",
};

export default function ShareCodePage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-center text-2xl font-semibold text-[#1f2328]">兑换分享码</h1>
      <p className="mt-2 text-center text-sm text-[#656d76]">
        输入邀请码注册，或输入工作流码领取分享的模板/项目。
      </p>
      <div className="mt-8">
        <ShareCodeInputForm />
      </div>
    </main>
  );
}
