type Props = {
  title?: string;
};

/** 费用区页眉：仅页面标题（面包屑与右侧占位按钮已移除）。 */
export function FeesHeader({ title = "账单详情" }: Props) {
  return (
    <header className="border-b border-[#e8e8e8] bg-white">
      <div className="flex h-14 items-center px-6">
        <h1 className="text-base font-medium text-[#262626]">{title}</h1>
      </div>
    </header>
  );
}
