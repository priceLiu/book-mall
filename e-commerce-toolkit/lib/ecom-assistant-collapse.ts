import {
  useCallback,
  useState,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/** 中栏空白点击：非交互控件区域才触发助手折叠 */
export function isEcomMainBlankPointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest(
    "button, a, input, textarea, select, option, label, summary, [role='button'], [role='link'], [role='tab'], [contenteditable='true'], [data-ecom-no-assistant-collapse]",
  );
}

export function useEcomAssistantCollapseHandlers(opts: {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseBlocked?: boolean;
  rootRef: RefObject<HTMLElement | null>;
}) {
  const { collapsed, onCollapsedChange, collapseBlocked = false, rootRef } = opts;

  const tryCollapse = useCallback(() => {
    if (collapseBlocked) return;
    onCollapsedChange?.(true);
  }, [collapseBlocked, onCollapsedChange]);

  const tryExpand = useCallback(() => {
    onCollapsedChange?.(false);
  }, [onCollapsedChange]);

  const handleAssistantBlur = useCallback(
    (e: FocusEvent) => {
      if (collapsed || collapseBlocked) return;
      const root = rootRef.current;
      if (!root) return;
      const next = e.relatedTarget;
      if (next instanceof Node && root.contains(next)) return;
      onCollapsedChange?.(true);
    },
    [collapsed, collapseBlocked, onCollapsedChange, rootRef],
  );

  return { tryCollapse, tryExpand, handleAssistantBlur };
}

/** Studio 级：中栏空白折叠 + assistantCollapsed 状态 */
export function useEcomStudioAssistantCollapse(assistantStreaming: boolean) {
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);

  const handleMainBlankPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (assistantCollapsed || assistantStreaming) return;
      if (!isEcomMainBlankPointerTarget(e.target)) return;
      setAssistantCollapsed(true);
    },
    [assistantCollapsed, assistantStreaming],
  );

  return {
    assistantCollapsed,
    setAssistantCollapsed,
    handleMainBlankPointerDown,
  };
}
