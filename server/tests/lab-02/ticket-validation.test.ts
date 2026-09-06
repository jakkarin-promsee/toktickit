import { describe, expect, it } from "vitest";
import { validateCreateTicketInput } from "../../src/ticket-validation.js";

const validInput = {
  categoryId: 2,
  relatedSystemId: 7,
  summary: "  Laptop battery drains quickly  ",
  requestedPriority: "MEDIUM",
  description: "  Battery falls from full to 20% within one hour.  ",
};

describe("UNIT-02 Create Ticket validation", () => {
  it("trims editable text and preserves the valid payload", () => {
    expect(validateCreateTicketInput(validInput)).toEqual({
      ok: true,
      value: {
        ...validInput,
        summary: "Laptop battery drains quickly",
        description: "Battery falls from full to 20% within one hour.",
      },
    });
  });

  it("accepts the documented Unicode length boundaries", () => {
    expect(
      validateCreateTicketInput({
        ...validInput,
        summary: "ก".repeat(5),
        description: "ก".repeat(10),
      }).ok,
    ).toBe(true);

    expect(
      validateCreateTicketInput({
        ...validInput,
        summary: "ก".repeat(120),
        description: "ก".repeat(2_000),
      }).ok,
    ).toBe(true);
  });

  it("rejects missing, invalid, and out-of-range fields", () => {
    const result = validateCreateTicketInput({
      categoryId: 0,
      relatedSystemId: "7",
      summary: "no",
      requestedPriority: "URGENT",
      description: "short",
    });

    expect(result).toEqual({
      ok: false,
      fields: {
        categoryId: "Category is required.",
        relatedSystemId: "Related System is required.",
        summary: "Summary must contain 5–120 characters.",
        description: "Description must contain 10–2,000 characters.",
        requestedPriority: "Requested Priority must be LOW, MEDIUM, or HIGH.",
      },
    });
  });

  it("rejects client-owned generated fields", () => {
    const result = validateCreateTicketInput({
      ...validInput,
      requesterId: 1,
      currentStatus: "NEW",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.form).toMatch(/read-only/i);
    }
  });
});
