import { describe, expect, it } from "vitest";

import {
  buildLoginRedirectForCheckout,
  buildMembershipCheckoutPath,
} from "@/lib/payments/checkout-login-redirect";

describe("checkout login redirect", () => {
  it("encodes callbackUrl so planId is not lost", () => {
    const path = buildMembershipCheckoutPath({ planId: "plan_abc", seats: 5 });
    const login = buildLoginRedirectForCheckout(path);
    expect(login).toBe(
      `/login?callbackUrl=${encodeURIComponent("/checkout/membership?planId=plan_abc&seats=5")}`,
    );
  });
});
