/** 侧栏站内跳转进行中：工作台轮询应暂停 setState，避免打断 Next 路由 transition */
let navInFlight = false;

export function markEcomSidebarNavIntent(): void {
  navInFlight = true;
}

export function clearEcomSidebarNavIntent(): void {
  navInFlight = false;
}

export function isEcomSidebarNavInFlight(): boolean {
  return navInFlight;
}