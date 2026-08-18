import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

const mocks = vi.hoisted(() => ({
  previewModelCredits: vi.fn(),
  getAccountCreditBalances: vi.fn(),
}));

vi.mock("@/lib/billing/model-credits-preview", () => ({
  previewModelCredits: mocks.previewModelCredits,
}));

vi.mock("@/lib/billing/credit-account-service", () => ({
  getAccountCreditBalances: mocks.getAccountCreditBalances,
}));

import { previewQrGenerateCredits } from "@/lib/quick-replica/qr-credits-preview";

const { previewModelCredits, getAccountCreditBalances } = mocks;

function baseDraft(overrides: Partial<QrWorkspaceDraft> = {}): QrWorkspaceDraft {
  return {
    category: "video",
    kind: "text-to-video",
    toolKey: undefined,
    targetImageUrl: "",
    referenceVideoUrl: "",
    referenceAudioUrl: "",
    sceneImageUrls: [],
    prompt: "test",
    modelKey: "kling/v3-turbo-text-to-video",
    ...overrides,
  };
}

describe("previewQrGenerateCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccountCreditBalances.mockResolvedValue({ balance: 1000, reserved: 0 });
    previewModelCredits.mockImplementation(async (input: { modelKey: string }) => {
      if (input.modelKey.includes("motion-control")) return { estimatedCredits: 300 };
      if (input.modelKey.includes("text-to-video")) return { estimatedCredits: 200 };
      if (input.modelKey.includes("nano")) return { estimatedCredits: 12 };
      if (input.modelKey.includes("speech")) return { estimatedCredits: 8 };
      if (input.modelKey.includes("marble")) return { estimatedCredits: 50 };
      if (input.modelKey.includes("sound-effects")) return { estimatedCredits: 15 };
      return { estimatedCredits: 100 };
    });
  });

  it("文生图传递 resolution 与 imageCount", async () => {
    const draft = baseDraft({
      category: "image",
      kind: "create-image",
      modelKey: "lib-nano-pro",
      resolution: "2K",
    });
    const result = await previewQrGenerateCredits("user-1", draft);
    expect(result.estimatedCredits).toBe(12);
    expect(result.sufficient).toBe(true);
    expect(previewModelCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: "lib-nano-pro",
        imageCount: 1,
        resolution: "2K",
        ownerType: "USER",
        ownerId: "user-1",
      }),
    );
  });

  it("文生视频传递 durationSec 与 resolution", async () => {
    const draft = baseDraft({
      duration: 8,
      resolution: "720p",
    });
    await previewQrGenerateCredits("user-1", draft);
    expect(previewModelCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: "kling/v3-turbo-text-to-video",
        durationSec: 8,
        resolution: "720p",
      }),
    );
  });

  it("运动同步默认时长（null → previewModelCredits 侧 15s 封顶）", async () => {
    const draft = baseDraft({
      kind: "motion-sync",
      toolKey: "motion-sync",
      modelKey: "kling-2.6/motion-control",
    });
    const result = await previewQrGenerateCredits("user-1", draft);
    expect(result.estimatedCredits).toBe(300);
    expect(previewModelCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: "kling-2.6/motion-control",
        durationSec: null,
      }),
    );
  });

  it("TTS 旁白按 modelKey 估算", async () => {
    const draft = baseDraft({
      category: "audio",
      kind: "create-voiceover",
      modelKey: "MiniMax/speech-2.8-hd",
    });
    const result = await previewQrGenerateCredits("user-1", draft);
    expect(result.estimatedCredits).toBe(8);
    expect(previewModelCredits).toHaveBeenCalledWith(
      expect.objectContaining({ modelKey: "MiniMax/speech-2.8-hd" }),
    );
  });

  it("create-world 使用 Marble modelKey", async () => {
    const draft = baseDraft({
      category: "world",
      kind: "create-world",
      modelKey: "marble-1.1-plus",
    });
    await previewQrGenerateCredits("user-1", draft);
    expect(previewModelCredits).toHaveBeenCalledWith(
      expect.objectContaining({ modelKey: "marble-1.1-plus" }),
    );
  });

  it("SFX 传递 sfx 时长", async () => {
    const draft = baseDraft({
      category: "audio",
      kind: "create-sfx",
      modelKey: "Eleven/sound-effects-v2",
      sfxDurationAuto: false,
      sfxDurationSeconds: 12,
    });
    await previewQrGenerateCredits("user-1", draft);
    expect(previewModelCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: "Eleven/sound-effects-v2",
        durationSec: 12,
      }),
    );
  });

  it("余额不足时 sufficient=false", async () => {
    getAccountCreditBalances.mockResolvedValue({ balance: 50, reserved: 0 });
    previewModelCredits.mockResolvedValue({ estimatedCredits: 200 });
    const result = await previewQrGenerateCredits("user-1", baseDraft());
    expect(result.sufficient).toBe(false);
    expect(result.label).toBe("约 200 积分");
    expect(result.billingPersona).toBe("PLATFORM_CREDIT");
  });
});
