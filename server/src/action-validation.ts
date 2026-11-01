const OFFSET_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

export type ActionContent = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseActionContent(body: Record<string, unknown>, ticketCreatedAt: Date, now = new Date()): { value?: ActionContent; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const rawAt = body.actionAt;
  const actionAt = typeof rawAt === "string" && OFFSET_TIMESTAMP.test(rawAt) ? new Date(rawAt) : new Date(NaN);
  const offset = typeof rawAt === "string" && rawAt.endsWith("Z") ? 0 : typeof rawAt === "string" ? Number(rawAt.slice(-6, -3)) * 60 + Number(rawAt.slice(-2)) * (rawAt.slice(-6, -5) === "-" ? -1 : 1) : 0;
  const calendarValid = typeof rawAt === "string" && !Number.isNaN(actionAt.getTime()) && new Date(actionAt.getTime() + offset * 60_000).toISOString().slice(0, 19) === rawAt.slice(0, 19);
  if (!calendarValid || actionAt < ticketCreatedAt || actionAt.getTime() > now.getTime() + 365 * 86400000) fields.actionAt = "Enter an offset date/time from Ticket creation through the next 365 days.";

  function text(key: string, max: number, min: number): string {
    const raw = body[key];
    if (typeof raw !== "string") {
      fields[key] = `Enter ${min}–${max} characters.`;
      return "";
    }
    const trimmed = raw.trim();
    const length = Array.from(trimmed).length;
    if (length < min || length > max) fields[key] = `Enter ${min}–${max} characters.`;
    return trimmed;
  }
  const description = text("description", 2000, 1);
  const result = body.result === undefined ? "" : text("result", 2000, 0);
  if (typeof body.followUpRequired !== "boolean") fields.followUpRequired = "Choose whether follow-up is required.";
  const followUpRequired = body.followUpRequired === true;
  let followUpNote: string | null = null;
  if (followUpRequired) followUpNote = text("followUpNote", 1000, 1);
  else if (body.followUpNote !== null) fields.followUpNote = "Follow-up note must be null when follow-up is not required.";
  let attachmentNotes: string | null = null;
  if (body.attachmentNotes !== null) {
    attachmentNotes = text("attachmentNotes", 500, 0);
    if (attachmentNotes === "") attachmentNotes = null;
  }
  return { fields, ...(Object.keys(fields).length ? {} : { value: { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } }) };
}
