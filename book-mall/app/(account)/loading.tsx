import { Loader2 } from "lucide-react";

export default function AccountLoading() {
  return (
    <div
      className="flex min-h-[min(24rem,50vh)] flex-col items-center justify-center gap-3 py-12 text-[#656d76]"
      role="status"
      aria-live="polite"
      aria-label="个人中心加载中"
    >
      <Loader2 className="size-8 animate-spin text-[#8c959f]" aria-hidden />
      <p className="text-sm">正在加载个人中心…</p>
    </div>
  );
}
