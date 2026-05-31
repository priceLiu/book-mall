// 平台壳运行时配置（须在 main bundle 之前加载）
(function () {
  var origin = "";
  try {
    if (typeof window !== "undefined" && window.location) {
      var h = window.location.hostname;
      var p = window.location.protocol;
      origin =
        h === "localhost" || h === "127.0.0.1"
          ? p + "//" + h + ":3005"
          : p + "//gateway." + h.replace(/^[^.]+\./, "");
    }
  } catch (_e) {
    origin = "";
  }

  window.runtime_config = {
    PLATFORM_GATEWAY: "1",
    GATEWAY_WEB_ORIGIN: origin || "http://localhost:3005",
  };
  console.log("[config.js] platform gateway mode enabled");
})();
