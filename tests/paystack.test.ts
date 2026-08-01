import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizePaystackStatus, verifyPaystackTransaction } from "../lib/paystack";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.PAYSTACK_REQUEST_TIMEOUT_MS;
});

describe("normalizePaystackStatus", () => {
  it.each([
    ["success", "success"],
    ["reversed", "failed"],
    ["abandoned", "abandoned"],
    ["processing", "pending"],
    ["mystery", "unknown"],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizePaystackStatus(input)).toBe(expected);
  });
});

describe("Paystack timeout", () => {
  it("aborts verification and returns a retryable timeout error", async () => {
    vi.useFakeTimers();
    process.env.PAYSTACK_REQUEST_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const verification = verifyPaystackTransaction("secret", "REF-1");
    const assertion = expect(verification).rejects.toMatchObject({
      code: "PAYSTACK_TIMEOUT",
      status: 503,
      retryable: true,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
