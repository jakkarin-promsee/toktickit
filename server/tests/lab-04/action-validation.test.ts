import { describe, expect, it } from "vitest";
import { parseActionContent, validVersion } from "../../src/action-validation.js";

const created = new Date("2026-10-31T09:00:00.000Z");
const now = new Date("2026-10-31T10:00:00.000Z");
const body = () => ({ actionAt: "2026-10-31T16:30:00+07:00", description: "Inspect access", result: "", followUpRequired: false, followUpNote: null, attachmentNotes: null });

describe("Lab 4 Action content boundaries", () => {
  it("accepts a valid offset instant, trims shared text, and defaults an omitted Result", () => {
    const parsed = parseActionContent({ ...body(), description: "  Inspect access  ", result: undefined }, created, now);
    expect(parsed.fields).toEqual({});
    expect(parsed.value).toMatchObject({ actionAt: new Date("2026-10-31T09:30:00.000Z"), description: "Inspect access", result: "" });
  });

  it("rejects impossible, offset-free, pre-Ticket, and beyond-365-day timestamps", () => {
    for (const actionAt of ["2026-02-30T09:30:00Z", "2026-10-31T09:30:00", "2026-10-31T08:59:59Z", new Date(now.getTime() + 365 * 86400000 + 1).toISOString()]) {
      expect(parseActionContent({ ...body(), actionAt }, created, now).fields.actionAt, actionAt).toBeTruthy();
    }
    expect(parseActionContent({ ...body(), actionAt: created.toISOString() }, created, now).fields).toEqual({});
    expect(parseActionContent({ ...body(), actionAt: new Date(now.getTime() + 365 * 86400000).toISOString() }, created, now).fields).toEqual({});
  });

  it("counts Unicode characters and enforces the conditional follow-up note", () => {
    expect(parseActionContent({ ...body(), description: "🙂".repeat(2000) }, created, now).fields).toEqual({});
    expect(parseActionContent({ ...body(), description: "🙂".repeat(2001) }, created, now).fields.description).toBeTruthy();
    expect(parseActionContent({ ...body(), followUpRequired: true, followUpNote: "  " }, created, now).fields.followUpNote).toBeTruthy();
    expect(parseActionContent({ ...body(), followUpRequired: true, followUpNote: " Check tomorrow " }, created, now).value?.followUpNote).toBe("Check tomorrow");
    expect(parseActionContent({ ...body(), followUpRequired: false, followUpNote: "stale note" }, created, now).fields.followUpNote).toBeTruthy();
  });

  it("rejects malformed field types, overlong Result and Attachment Notes, and invalid versions", () => {
    const parsed = parseActionContent({ ...body(), description: 4, result: "r".repeat(2001), attachmentNotes: "a".repeat(501), followUpRequired: "yes" }, created, now);
    expect(Object.keys(parsed.fields).sort()).toEqual(["attachmentNotes", "description", "followUpRequired", "result"]);
    expect(parsed.value).toBeUndefined();
    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null]) expect(validVersion(invalid)).toBe(false);
    expect(validVersion(0)).toBe(true);
  });
});
