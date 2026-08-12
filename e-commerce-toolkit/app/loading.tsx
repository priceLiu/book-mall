/** 路由切换即时反馈，避免等待 layout / 页面数据期间侧栏无响应感 */
export default function EcomRouteLoading() {
  return (
    <div className="flex h-full min-h-[12rem] flex-col bg-white">
      <div className="h-1 w-full shrink-0 overflow-hidden bg-[#e8e8ed]">
        <div className="h-full w-1/3 animate-pulse bg-[#0071e3]/70" />
      </div>
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#6e6e73]">
        正在加载…
      </div>
    </div>
  );
}
