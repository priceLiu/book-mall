import { Prisma } from "@prisma/client";
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  PrismaPoolBusyError,
  acquirePrismaDbSlot,
  getPrismaDbGateSnapshot,
  isPrismaPoolTimeoutError,
  recordPrismaPoolTimeout,
  releasePrismaDbSlot,
  resetPrismaDbGateForTests,
  resolvePrismaDbMaxInFlight,
} from "@/lib/prisma-db-gate";

vi.mock("@/lib/prisma-pool-config", () => ({
  getPrismaConnectionLimit: () => 10,
}));

describe("prisma-db-gate", () => {
  beforeEach(() => {
    process.env.PRISMA_DB_GATE = "1";
    resetPrismaDbGateForTests();
    vi.useRealTimers();
  });

  it("caps in-flight queries below connection limit minus reserve", () => {
    expect(resolvePrismaDbMaxInFlight()).toBe(5);
  });

  it("opens circuit after repeated pool timeouts", () => {
    const err = new Prisma.PrismaClientKnownRequestError("pool", {
      code: "P2024",
      clientVersion: "test",
    });
    for (let i = 0; i < 5; i++) recordPrismaPoolTimeout(err);
    expect(getPrismaDbGateSnapshot().circuitOpen).toBe(true);
    expect(() => acquirePrismaDbSlot()).rejects.toBeInstanceOf(PrismaPoolBusyError);
  });

  it("releases slot and admits queued waiter", async () => {
    const max = resolvePrismaDbMaxInFlight();
    const slots: Promise<void>[] = [];
    for (let i = 0; i < max; i++) {
      slots.push(acquirePrismaDbSlot());
    }
    await Promise.all(slots);
    expect(getPrismaDbGateSnapshot().inFlight).toBe(max);

    const waiting = acquirePrismaDbSlot();
    await new Promise((r) => setTimeout(r, 20));
    expect(getPrismaDbGateSnapshot().waitQueue).toBe(1);

    releasePrismaDbSlot();
    await waiting;
    expect(getPrismaDbGateSnapshot().waitQueue).toBe(0);
  });

  it("detects pool timeout errors", () => {
    expect(
      isPrismaPoolTimeoutError(
        new Prisma.PrismaClientKnownRequestError("x", {
          code: "P2024",
          clientVersion: "test",
        }),
      ),
    ).toBe(true);
    expect(isPrismaPoolTimeoutError(new PrismaPoolBusyError())).toBe(true);
  });
});
