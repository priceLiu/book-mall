export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyBookMallProductionOriginDefaults } = await import(
      "./lib/production-origin"
    );
    applyBookMallProductionOriginDefaults();

    // 生视频看门狗 · 常驻定时巡检（不依赖外部 poll-loop / 是否有人看 Logs 页）。
    try {
      const { startResidentGatewayVideoWatchdog } = await import(
        "./lib/gateway/gateway-video-watchdog-scheduler"
      );
      startResidentGatewayVideoWatchdog();
    } catch (e) {
      console.warn(
        "[gateway-watchdog] resident scheduler init skipped",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
