import { describe, expect, it } from "vitest";

import {
  isBillingDbBusyError,
  isMislabeledInsufficientCreditsLog,
  mapBillingFailureForGatewayLog,
} from "@/lib/billing/billing-failure-map";
import { InsufficientCreditsError } from "@/lib/billing/credit-account-service";

describe("billing-failure-map", () => {
  it("maps prisma tx timeout to SYSTEM_BUSY", () => {
    const e = new Error(
      "Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 19274 ms passed since the start of the transaction.",
    );
    expect(isBillingDbBusyError(e)).toBe(true);
    expect(mapBillingFailureForGatewayLog(e).failCode).toBe("SYSTEM_BUSY");
  });

  it("maps real insufficient credits", () => {
    const e = new InsufficientCreditsError(0, 100);
    expect(mapBillingFailureForGatewayLog(e).failCode).toBe("INSUFFICIENT_CREDITS");
  });

  it("detects mislabeled historical log", () => {
    expect(
      isMislabeledInsufficientCreditsLog({
        failCode: "INSUFFICIENT_CREDITS",
        failMessage:
          "Invalid `prisma.creditLedger.create()` invocation: Transaction already closed",
      }),
    ).toBe(true);
  });
});
