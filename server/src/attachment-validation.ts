import path from "node:path";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVE_ATTACHMENTS = 5;

type AttachmentRule = {
  mimeType: string;
  extensions: string[];
  signature: (bytes: Buffer) => boolean;
};

const RULES: AttachmentRule[] = [
  {
    mimeType: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
    signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mimeType: "image/png",
    extensions: [".png"],
    signature: (bytes) =>
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/webp",
    extensions: [".webp"],
    signature: (bytes) =>
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    mimeType: "application/pdf",
    extensions: [".pdf"],
    signature: (bytes) => bytes.subarray(0, 5).toString("ascii") === "%PDF-",
  },
];

export type ValidatedAttachment = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extension: string;
};

export function validateAttachment(file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): { ok: true; value: ValidatedAttachment } | { ok: false; status: 413 | 415; message: string } {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, status: 413, message: "Attachment must be 5 MB or smaller." };
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const rule = RULES.find(
    (candidate) => candidate.mimeType === file.mimetype && candidate.extensions.includes(extension),
  );
  if (!rule || !rule.signature(file.buffer)) {
    return { ok: false, status: 415, message: "Attachment type or file signature is not supported." };
  }

  const originalName = path.basename(file.originalname).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!originalName) {
    return { ok: false, status: 415, message: "Attachment filename is invalid." };
  }

  return {
    ok: true,
    value: { originalName, mimeType: rule.mimeType, sizeBytes: file.size, extension },
  };
}

export function removalReasonError(reason: unknown): string | null {
  if (typeof reason !== "string") return "Removal reason is required.";
  const length = Array.from(reason.trim()).length;
  return length >= 10 && length <= 250
    ? null
    : "Removal reason must contain 10–250 characters.";
}
