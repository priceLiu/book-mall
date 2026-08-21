import { describe, expect, it } from "vitest";
import {
  formatCanvasTaskError,
  inferLlmVendorFromModelKey,
  isGatewayImageModelKey,
} from "@/lib/canvas/friendly-task-error";

describe("isGatewayImageModelKey", () => {
  it("recognizes nano-banana as image", () => {
    expect(isGatewayImageModelKey("nano-banana-pro")).toBe(true);
  });

  it("does not treat nano-banana as LLM vendor", () => {
    expect(inferLlmVendorFromModelKey("nano-banana-pro")).toBe("unknown");
  });
});

describe("formatCanvasTaskError", () => {
  it("maps vendor unsafe image rejection to Chinese hint", () => {
    expect(
      formatCanvasTaskError(
        "IMAGE_ENGINE_FAILED",
        "The generated images appear to be unsafe. Try modifying the prompts.",
        "nano-banana-pro",
      ),
    ).toBe("内容被安全策略拦截，请修改提示词或参考图后重试。");
  });

  it("maps auth failures to re-login hint", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "401 UNAUTHORIZED",
        "happyhorse-1.1-t2v",
      ),
    ).toBe("登录状态已过期，请刷新页面或重新连接主站账号后再生成。");
  });

  it("maps db/proxy overload to system busy (not model unavailable)", () => {
    expect(
      formatCanvasTaskError(
        "SYSTEM_BUSY",
        "503 服务繁忙，请稍后再试",
        "happyhorse-1.1-t2v",
      ),
    ).toContain("系统繁忙或主站连接异常");
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "503 DATABASE_UNAVAILABLE",
        "happyhorse-1.1-t2v",
      ),
    ).toContain("系统繁忙或主站连接异常");
  });

  it("short image timeout message without Gemini hint", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "KIE API 连接超时（api.kie.ai）",
        "nano-banana-pro",
      ),
    ).toBe("生图服务暂时不可用，请稍后重试。");
  });

  it("OSS upload failure is not labeled as image service down", () => {
    expect(
      formatCanvasTaskError(
        "OSS_UPLOAD_FAILED",
        "socket disconnected before secure TLS connection was established",
        "nano-banana-pro",
      ),
    ).toContain("保存到云存储失败");
  });

  it("dev database unreachable mentions db:ping", () => {
    expect(
      formatCanvasTaskError(
        "FAILED",
        "Can't reach database server at cdb-xxx.tencentcdb.com:24155",
        "nano-banana-pro",
      ),
    ).toContain("db:ping");
  });

  it("short LLM timeout message", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "fetch failed",
        "google/gemini-3-flash",
      ),
    ).toBe("文本模型服务暂时不可用，请稍后重试。");
  });

  it("maps DeepSeek TLS handshake drop to DeepSeek unavailable", () => {
    expect(
      formatCanvasTaskError(
        "FAILED",
        "DEEPSEEK API 请求失败: Client network socket disconnected before secure TLS connection was established",
        "deepseek-v4-flash",
      ),
    ).toBe("DeepSeek 服务暂时不可用，请稍后重试。");
  });

  it("Kling video timeout uses generic service message (DashScope route)", () => {
    expect(
      formatCanvasTaskError(
        "VIDEO_ENGINE_FAILED",
        "KIE API 连接超时，请稍后重试。",
        "kling-3.0/video",
      ),
    ).toBe("模型服务暂时不可用，请稍后重试。");
  });

  it("KIE quota on image model shows balance hint", () => {
    expect(
      formatCanvasTaskError(
        "PROVIDER_QUOTA_EXCEEDED",
        "KIE 余额不足，请充值后重试",
        "nano-banana-pro",
      ),
    ).toBe("KIE 生图账户余额不足，请充值 Gateway 绑定的 KIE 凭证后重试。");
  });

  it("INSUFFICIENT_CREDITS without prisma noise", () => {
    expect(
      formatCanvasTaskError(
        "INSUFFICIENT_CREDITS",
        "reserve failed",
        "nano-banana-pro",
      ),
    ).toContain("平台积分不足");
  });

  it("Kling image product-not-activated points to Bailian not KIE", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "createTask code=422 msg=The product is not activated",
        "kling-3.0-image",
      ),
    ).toContain("阿里云百炼");
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "createTask code=422 msg=The product is not activated",
        "kling-3.0-image",
      ),
    ).not.toContain("KIE 控制台");
  });

  it("Kling video product-not-activated points to Bailian", () => {
    expect(
      formatCanvasTaskError(
        "VIDEO_ENGINE_FAILED",
        "The product is not activated",
        "kling-3.0/video",
      ),
    ).toContain("阿里云百炼");
    expect(
      formatCanvasTaskError(
        "VIDEO_ENGINE_FAILED",
        "The product is not activated",
        "kling-3.0/video",
      ),
    ).not.toContain("KIE 控制台");
  });

  it("Kling motion-control product-not-activated still points to KIE", () => {
    expect(
      formatCanvasTaskError(
        "VIDEO_ENGINE_FAILED",
        "The product is not activated",
        "kling-3.0/motion-control",
      ),
    ).toContain("KIE 控制台");
  });

  it("strips long gateway technical messages", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "Gateway 内部链路超时（book-mall 自调用 /api/gw/v1）",
        "nano-banana-pro",
      ),
    ).toBe("生图服务暂时不可用，请稍后重试。");
  });
});
