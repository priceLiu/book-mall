import { cn } from "@/lib/utils";

type ShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** 财务右侧主内容：统一内边距与纵向间距 */
export function FinancePageShell({ children, className }: ShellProps) {
  return (
    <div className={cn("flex w-full flex-col gap-4 p-6", className)}>
      {children}
    </div>
  );
}

/** 顶栏贴边全宽（账单明细等），内容区在子组件内再 p-6 */
export function FinancePageBleed({ children, className }: ShellProps) {
  return (
    <div className={cn("flex w-full flex-col", className)}>
      {children}
    </div>
  );
}

/** 加载 / 错误态，与 FinancePageShell 内边距一致 */
export function FinancePageState({
  children,
  className,
  variant = "muted",
}: ShellProps & { variant?: "muted" | "error" }) {
  return (
    <div
      className={cn(
        "p-6 text-sm",
        variant === "error" ? "text-red-600" : "text-[#8c8c8c]",
        className,
      )}
    >
      {children}
    </div>
  );
}
