import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  apiDbUnavailableResponse,
  tryApiDbUnavailableResponse,
} from "@/lib/http/api-db-error";
import { DbUnavailableError } from "@/lib/db-unavailable";

describe("api-db-error", () => {
  it("returns 503 SYSTEM_BUSY for DbUnavailableError", async () => {
    const resp = tryApiDbUnavailableResponse(new DbUnavailableError());
    expect(resp?.status).toBe(503);
    const body = await resp!.json();
    expect(body.error).toBe("SYSTEM_BUSY");
    expect(typeof body.message).toBe("string");
  });

  it("returns null for non-db errors", () => {
    expect(tryApiDbUnavailableResponse(new Error("nope"))).toBeNull();
  });

  it("apiDbUnavailableResponse defaults to 503", () => {
    const resp = apiDbUnavailableResponse();
    expect(resp.status).toBe(503);
  });

  it("handles P2024", async () => {
    const resp = tryApiDbUnavailableResponse(
      new Prisma.PrismaClientKnownRequestError("x", {
        code: "P2024",
        clientVersion: "test",
      }),
    );
    expect(resp?.status).toBe(503);
  });
});
