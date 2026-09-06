import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  removalReasonError,
  validateAttachment,
} from "../../src/attachment-validation.js";

describe("attachment validation", () => {
  it("accepts coherent supported files at the exact size boundary", () => {
    const result = validateAttachment({
      originalname: "evidence.PNG",
      mimetype: "image/png",
      size: MAX_ATTACHMENT_BYTES,
      buffer: Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(MAX_ATTACHMENT_BYTES - 8),
      ]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        originalName: "evidence.PNG",
        mimeType: "image/png",
        sizeBytes: MAX_ATTACHMENT_BYTES,
        extension: ".png",
      },
    });
  });

  it("rejects oversized, mismatched, and invalid-signature files", () => {
    expect(
      validateAttachment({
        originalname: "large.pdf",
        mimetype: "application/pdf",
        size: MAX_ATTACHMENT_BYTES + 1,
        buffer: Buffer.from("%PDF-"),
      }),
    ).toMatchObject({ status: 413 });

    expect(
      validateAttachment({
        originalname: "evidence.pdf",
        mimetype: "image/png",
        size: 8,
        buffer: Buffer.from("%PDF-123"),
      }),
    ).toMatchObject({ status: 415 });
  });

  it("requires a trimmed removal reason between 10 and 250 characters", () => {
    expect(removalReasonError(" too short ")).toBe("Removal reason must contain 10–250 characters.");
    expect(removalReasonError("  The file is no longer needed.  ")).toBeNull();
    expect(removalReasonError("x".repeat(251))).toBe("Removal reason must contain 10–250 characters.");
  });
});
