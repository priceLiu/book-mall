import Link from "next/link";

export default function AdminBillingUsersIndexPage() {
  return (
    <div className="p-6 text-sm text-[#595959]">
      <p className="mb-2">
        请访问{" "}
        <code className="rounded bg-white px-1 text-[#262626]">/admin/billing/users/&lt;book-mall User.id&gt;</code>{" "}
        ，例如从 book-mall 用户表复制 id。
      </p>
      <Link href="/admin" className="text-[#1890ff] hover:underline">
        返回管理概览
      </Link>
    </div>
  );
}
