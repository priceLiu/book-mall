import { describe, expect, it } from "vitest";

import {
  checkoutDedupeScope,
  paymentCheckoutsSameProduct,
  wechatAmountMatchesCheckout,
} from "@/lib/payments/checkout-create-dedupe";

describe("checkout-create-dedupe", () => {
  it("scopes CREDIT_TOPUP by pack and target", () => {
    expect(
      checkoutDedupeScope("CREDIT_TOPUP", {
        packId: "video-pack-admin-5000",
        target: "personal",
      }),
    ).toBe("CREDIT_TOPUP:video-pack-admin-5000:personal");
  });

  it("detects same topup product", () => {
    expect(
      paymentCheckoutsSameProduct(
        "CREDIT_TOPUP",
        { packId: "pack-light", target: "personal" },
        { packId: "pack-light", target: "personal" },
      ),
    ).toBe(true);
    expect(
      paymentCheckoutsSameProduct(
        "CREDIT_TOPUP",
        { packId: "pack-light", target: "personal" },
        { packId: "pack-standard", target: "personal" },
      ),
    ).toBe(false);
  });

  it("matches wechat fen amount to checkout yuan", () => {
    expect(wechatAmountMatchesCheckout(0.01, 1)).toBe(true);
    expect(wechatAmountMatchesCheckout(62, 6200)).toBe(true);
    expect(wechatAmountMatchesCheckout(0.01, 2)).toBe(false);
  });
});
