import Link from "next/link";
import { HelpCircle } from "lucide-react";

type Props = {
  breadcrumbs?: string[];
  title?: string;
};

export function FeesHeader({ breadcrumbs = ["费用与成本", "账单详情"], title = "账单详情" }: Props) {
  return (
    <header className="border-b border-[#e8e8e8] bg-white">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex flex-col gap-0.5">
          <div className="text-xs text-[#8c8c8c]">
            {breadcrumbs.map((p, i) => (
              <span key={p}>
                {i > 0 && <span className="mx-1">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "text-[#262626]" : ""}>{p}</span>
              </span>
            ))}
          </div>
          <h1 className="text-base font-medium text-[#262626]">{title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded border border-[#d9d9d9] bg-white px-3 py-1 text-[#595959] hover:border-[#1890ff] hover:text-[#1890ff]"
          >
            消费趋势分析
          </button>
          <button
            type="button"
            className="rounded border border-[#d9d9d9] bg-white px-3 py-1 text-[#595959] hover:border-[#1890ff] hover:text-[#1890ff]"
          >
            使用明细
          </button>
          <Link
            href="/admin"
            className="rounded border border-[#d9d9d9] bg-white px-3 py-1 text-[#595959] hover:border-[#1890ff] hover:text-[#1890ff]"
          >
            管理端
          </Link>
          <button
            type="button"
            className="flex items-center gap-1 text-[#1890ff]"
            aria-label="帮助"
          >
            <HelpCircle className="h-4 w-4" />
            帮助文档
          </button>
        </div>
      </div>
    </header>
  );
}
