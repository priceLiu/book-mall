import Link from "next/link";

/** 工具使用页 → 实现逻辑页的入口（文案统一） */
export function ToolImplementationCrossLink({
  href,
}: {
  href: string;
}) {
  return (
    <p className="tw-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
      <Link href={href}>实现逻辑</Link>
      <span> — 架构说明与核心代码摘录</span>
    </p>
  );
}
