import type { RequestedPriority } from "@prisma/client";

const SUMMARY_MIN_LENGTH = 5;
const SUMMARY_MAX_LENGTH = 120;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 2_000;

export type CreateTicketInput = {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
};

export type ValidationResult =
  | { ok: true; value: CreateTicketInput }
  | { ok: false; fields: Record<string, string> };

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function unicodeLength(value: string): number {
  return Array.from(value).length;
}

export function validateCreateTicketInput(
  body: unknown,
): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      fields: { form: "Request body must be an object." },
    };
  }

  const input = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const protectedFields = [
    "requesterId",
    "ticketNumber",
    "ticketDate",
    "currentStatus",
    "itPriority",
  ];

  if (protectedFields.some((field) => field in input)) {
    fields.form = "Generated and read-only fields cannot be submitted.";
  }

  if (!isPositiveInteger(input.categoryId)) {
    fields.categoryId = "Category is required.";
  }
  if (!isPositiveInteger(input.relatedSystemId)) {
    fields.relatedSystemId = "Related System is required.";
  }

  const summary =
    typeof input.summary === "string" ? input.summary.trim() : "";
  const summaryLength = unicodeLength(summary);
  if (summaryLength < SUMMARY_MIN_LENGTH || summaryLength > SUMMARY_MAX_LENGTH) {
    fields.summary = "Summary must contain 5–120 characters.";
  }

  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const descriptionLength = unicodeLength(description);
  if (
    descriptionLength < DESCRIPTION_MIN_LENGTH ||
    descriptionLength > DESCRIPTION_MAX_LENGTH
  ) {
    fields.description = "Description must contain 10–2,000 characters.";
  }

  if (
    input.requestedPriority !== "LOW" &&
    input.requestedPriority !== "MEDIUM" &&
    input.requestedPriority !== "HIGH"
  ) {
    fields.requestedPriority = "Requested Priority must be LOW, MEDIUM, or HIGH.";
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      categoryId: input.categoryId as number,
      relatedSystemId: input.relatedSystemId as number,
      summary,
      requestedPriority: input.requestedPriority as RequestedPriority,
      description,
    },
  };
}
