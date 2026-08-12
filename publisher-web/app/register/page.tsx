import Link from "next/link";

export const metadata = {
  title: "注册",
  description: "注册一键发布账号（与全站共用 Book 账号体系）",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">注册</h1>
        <p className="mb-6 text-sm text-[var(--pub-muted)]">
          注册功能与主站账号互通。请前往主站完成手机号注册，或联系管理员开通。
        </p>
        <Link href="/login" className="text-sm text-[var(--pub-primary)]">
          已有账号？去登录
        </Link>
      </div>
    </main>
  );
}
