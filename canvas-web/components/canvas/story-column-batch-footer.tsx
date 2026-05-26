"use client";

/** 漫剧引擎节点底栏主按钮：亮橙实心，禁用时不变暗 */
export const STORY_ORANGE_BTN_CLASS =
  "rounded-md bg-[#fb923c] font-medium text-black hover:bg-[#fdba74] disabled:cursor-not-allowed disabled:bg-[#fb923c] disabled:text-black disabled:opacity-100 disabled:hover:bg-[#fb923c]";

/** 漫剧三列节点底栏：固定在 NodeShell 底部，不随内容滚动 */
export function StoryColumnBatchFooter({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`nodrag h-9 w-full text-[12px] ${STORY_ORANGE_BTN_CLASS}`}
      title={disabled ? "请先在上方选择模型" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
