import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PrismaPoolBusyError } from "@/lib/prisma-db-gate";
import {
  DbUnavailableError,
  isDbUnavailableError,
  isPrismaConnectionUnavailable,
  toDbUnavailableError,
} from "@/lib/db-unavailable";
import { runDbQuery } from "@/lib/db-query";

describe("db-query", () => {
  it("runDbQuery returns fallback on pool busy", async () => {
    const result = await runDbQuery(
      "test",
      async () => {
        throw new PrismaPoolBusyError();
      },
      { ok: false },
    );
    expect(result).toEqual({ ok: false });
  });

  it("runDbQuery rethrows business errors", async () => {
    await expect(
      runDbQuery("test", async () => {
        throw new Error("validation failed");
      }, null),
    ).rejects.toThrow("validation failed");
  });

  it("toDbUnavailableError wraps P2024", () => {
    const err = new Prisma.PrismaClientKnownRequestError("pool", {
      code: "P2024",
      clientVersion: "test",
    });
    const wrapped = toDbUnavailableError(err);
    expect(isDbUnavailableError(wrapped)).toBe(true);
    expect(isPrismaConnectionUnavailable(wrapped)).toBe(true);
  });

  it("DbUnavailableError has SYSTEM_BUSY code", () => {
    expect(new DbUnavailableError().code).toBe("SYSTEM_BUSY");
  });
});

describe("db-query logging", () => {
  it("logs on fallback in development", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runDbQuery(
      "scoped",
      async () => {
        throw new DbUnavailableError();
      },
      "fallback",
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  });
});
