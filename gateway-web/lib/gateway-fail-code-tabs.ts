/** 状态驾驶舱 · 失败明细按 failCode 分 Tab（与 book-mall failCode 枚举对齐） */

export type GatewayFailCodeTab = {
  id: string;
  label: string;
  /** 空 = 全部失败 */
  failCode?: string;
  description?: string;
};

export const GATEWAY_FAIL_CODE_TABS: GatewayFailCodeTab[] = [
  { id: "all", label: "全部失败" },
  {
    id: "CONTENT_POLICY",
    label: "内容安全",
    failCode: "CONTENT_POLICY",
    description: "敏感词 / 素材审核",
  },
  {
    id: "INVALID_INPUT",
    label: "参数错误",
    failCode: "INVALID_INPUT",
    description: "比例、参考图、content 结构等",
  },
  {
    id: "UPSTREAM_SUBMIT_FAILED",
    label: "提交被拒",
    failCode: "UPSTREAM_SUBMIT_FAILED",
    description: "厂商 HTTP 拒绝且未创建 taskId",
  },
  {
    id: "SUBMIT_ORPHAN",
    label: "无 taskId",
    failCode: "SUBMIT_ORPHAN",
    description: "submit 挂起 / 进程中断",
  },
  {
    id: "VOLCENGINE_TASK_FAILED",
    label: "厂商任务失败",
    failCode: "VOLCENGINE_TASK_FAILED",
    description: "已有 taskId，poll 返回 failed",
  },
  {
    id: "STALE_TIMEOUT",
    label: "超时收口",
    failCode: "STALE_TIMEOUT",
  },
  {
    id: "VOLCENGINE_GATEWAY_POLL_STALL",
    label: "历史误杀可恢复",
    failCode: "VOLCENGINE_GATEWAY_POLL_STALL",
    description: "旧版停更收口；可向厂商复核恢复",
  },
];

export function resolveFailCodeTab(id: string): GatewayFailCodeTab {
  return (
    GATEWAY_FAIL_CODE_TABS.find((t) => t.id === id) ?? GATEWAY_FAIL_CODE_TABS[0]!
  );
}
