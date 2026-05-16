import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="p-6">
      <h1 className="mb-2 text-lg font-medium text-[#262626]">财务 · 管理端（静态演示）</h1>
      <p className="mb-6 max-w-2xl text-sm text-[#595959]">
        与 <code className="rounded bg-white px-1">0516</code> 备忘一致：管理端在同一套明细之上增加按用户、按模型等统计。当前页面为路由与布局占位，数据与
        用户端同源 CSV。
      </p>
      <ul className="space-y-2 text-sm text-[#1890ff]">
        <li>
          <Link href="/admin/billing/users" className="hover:underline">
            用户明细（在 URL 中填入 book-mall User.id）
          </Link>
        </li>
        <li>
          <Link href="/admin/models/coefficients" className="hover:underline">
            模型 / 全局零售系数
          </Link>
        </li>
      </ul>
    </div>
  );
}
