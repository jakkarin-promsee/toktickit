import { describe, expect, it, vi } from "vitest";
import {
  findAvailableTicketNumber,
  formatTicketNumber,
} from "../../src/ticket-number.js";

describe("UNIT-01 Ticket Number generation", () => {
  it("formats the UTC date and zero-padded sequence", () => {
    const instant = new Date("2026-09-06T23:30:00-07:00");

    expect(formatTicketNumber(instant, 42)).toBe("TKT-20260907-000042");
  });

  it("accepts the first and last six-digit sequence values", () => {
    const date = new Date("2026-09-06T00:00:00.000Z");

    expect(formatTicketNumber(date, 1)).toBe("TKT-20260906-000001");
    expect(formatTicketNumber(date, 999_999)).toBe("TKT-20260906-999999");
  });

  it.each([0, 1_000_000, 1.5, Number.NaN])(
    "rejects an invalid sequence value: %s",
    (sequence) => {
      expect(() =>
        formatTicketNumber(new Date("2026-09-06T00:00:00.000Z"), sequence),
      ).toThrow("sequence");
    },
  );

  it("retries with the next sequence when a candidate already exists", async () => {
    const isAvailable = vi
      .fn<(ticketNumber: string) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(
      findAvailableTicketNumber({
        date: new Date("2026-09-06T00:00:00.000Z"),
        startingSequence: 18,
        isAvailable,
      }),
    ).resolves.toBe("TKT-20260906-000019");

    expect(isAvailable).toHaveBeenNthCalledWith(1, "TKT-20260906-000018");
    expect(isAvailable).toHaveBeenNthCalledWith(2, "TKT-20260906-000019");
  });

  it("stops after the configured collision retry limit", async () => {
    const isAvailable = vi.fn().mockResolvedValue(false);

    await expect(
      findAvailableTicketNumber({
        date: new Date("2026-09-06T00:00:00.000Z"),
        startingSequence: 999_998,
        isAvailable,
        maxAttempts: 2,
      }),
    ).rejects.toThrow("Unable to allocate");

    expect(isAvailable).toHaveBeenCalledTimes(2);
  });
});
