import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { allowedTargets, transitionRule } from "../../src/status-transitions.js";
import { TICKET_STATUSES } from "../../src/staff-query.js";
import { csrfHeaders } from "./requester-test-session.js";

const prisma = getPrisma();
const origin = "http://localhost:5173";
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";
const emails = ["anan@example.test", "narin.staff@example.test", "kanda.staff@example.test", "araya.admin@example.test"];
const createdTicketIds: string[] = [];

type Status = (typeof TICKET_STATUSES)[number];

async function session(email: string) {
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password: initialPassword });
  expect(login.status).toBe(200);
  return { agent, csrf: csrfHeaders(login.body.data.csrfToken as string) };
}

async function makeTicket(options: { status?: Status; ownerEmail?: string | null; signal?: boolean } = {}) {
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } });
  const owner = options.ownerEmail ? await prisma.user.findUniqueOrThrow({ where: { email: options.ownerEmail } }) : null;
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();
  const count = await prisma.ticket.count();
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-20261004-7${String(count).padStart(5, "0")}`,
      submittedByUserId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      ownerId: owner?.id ?? null,
      summary: "Staff operation test",
      description: "Created by the staff ticket detail API test.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: options.status ?? "NEW",
      ...(options.signal ? { requesterResolvedAt: new Date(), requesterResolvedByUserId: requester.id } : {}),
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket;
}

beforeAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: emails } }, data: { mustChangePassword: false } });
});

afterAll(async () => {
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.user.updateMany({ where: { email: { in: emails } }, data: { mustChangePassword: true } });
  await prisma.$disconnect();
});

describe("UNIT-04 status transition matrix", () => {
  it("contains exactly the 19 approved transitions and rejects every other pair", () => {
    let permitted = 0;
    for (const from of TICKET_STATUSES) for (const to of TICKET_STATUSES) if (transitionRule(from, to)) permitted += 1;
    expect(permitted).toBe(19);
    expect(transitionRule("NEW", "RESOLVED")).toBeUndefined();
    expect(transitionRule("NEW", "NEW")).toBeUndefined();
    expect(transitionRule("CLOSED", "OPEN")).toBeUndefined();
    expect(transitionRule("RESOLVED", "IN_PROGRESS")).toBeUndefined();
    expect(allowedTargets("CLOSED")).toEqual(["REOPENED"]);
  });

  it("encodes owner, confirmation, and signal-clearing flags", () => {
    expect(transitionRule("NEW", "OPEN")).toEqual({ ownerRequired: false, confirmationRequired: false, clearsRequesterSignal: false });
    expect(transitionRule("NEW", "CANCELLED")?.confirmationRequired).toBe(true);
    expect(transitionRule("OPEN", "IN_PROGRESS")?.ownerRequired).toBe(true);
    expect(transitionRule("WAITING_FOR_REQUESTER", "IN_PROGRESS")?.clearsRequesterSignal).toBe(true);
    expect(transitionRule("CLOSED", "REOPENED")).toEqual({ ownerRequired: false, confirmationRequired: true, clearsRequesterSignal: true });
    expect(transitionRule("IN_PROGRESS", "RESOLVED")).toMatchObject({ ownerRequired: true, confirmationRequired: true });
  });
});

describe("API-08 Staff Ticket Detail retrieval", () => {
  it("returns full grouped detail with comments, notes, and attachments to IT Staff and Administrators", async () => {
    const ticket = await makeTicket({ ownerEmail: "narin.staff@example.test" });
    const narin = await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } });
    await prisma.publicComment.create({ data: { ticketId: ticket.id, authorId: narin.id, content: "Public" } });
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: narin.id, content: "Private" } });
    for (const email of ["narin.staff@example.test", "araya.admin@example.test"]) {
      const { agent } = await session(email);
      const response = await agent.get(`/api/staff/tickets/${ticket.id}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ id: ticket.id, description: "Created by the staff ticket detail API test.", requestedPriority: "LOW", itPriority: "LOW", owner: { displayName: "Narin Support" }, requester: { displayName: "Anan Chai" }, version: 0, attachments: [] });
      expect(response.body.data.publicComments.map((c: { content: string }) => c.content)).toEqual(["Public"]);
      expect(response.body.data.internalNotes.map((c: { content: string }) => c.content)).toEqual(["Private"]);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|csrfToken/);
    }
  });

  it("rejects Requesters, anonymous callers, malformed IDs, and reports missing tickets", async () => {
    const ticket = await makeTicket();
    expect((await request(app).get(`/api/staff/tickets/${ticket.id}`)).status).toBe(401);
    const requester = await session("anan@example.test");
    const denied = await requester.agent.get(`/api/staff/tickets/${ticket.id}`);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toContain("Staff operation test");
    const staff = await session("narin.staff@example.test");
    expect((await staff.agent.get("/api/staff/tickets/not-a-uuid")).status).toBe(400);
    expect((await staff.agent.get(`/api/staff/tickets/${MISSING_ID}`)).status).toBe(404);
  });

  it("lets Staff download existing attachments and keeps Staff from uploading or removing them", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    const upload = await staff.agent.post(`/api/tickets/${ticket.id}/attachments`).set(staff.csrf).attach("file", Buffer.from("%PDF-1.4\n%%EOF"), { filename: "a.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(403);
    const list = await staff.agent.get(`/api/tickets/${ticket.id}/attachments`);
    expect(list.status).toBe(200);
  });
});

describe("API-09 ownership", () => {
  it("lets Staff claim an unassigned ticket with backend actor/time and version increment", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    const response = await staff.agent.post(`/api/staff/tickets/${ticket.id}/claim`).set(staff.csrf).send({ version: 0 });
    expect(response.status).toBe(200);
    expect(response.body.data.owner.displayName).toBe("Narin Support");
    expect(response.body.data.version).toBe(1);
    expect(response.body.data.lastOwnerChangedBy.displayName).toBe("Narin Support");
    expect(response.body.data.lastOwnerChangedAt).toBeTruthy();
  });

  it("rejects claiming an already assigned ticket, stale versions, and bad bodies", async () => {
    const ticket = await makeTicket({ ownerEmail: "kanda.staff@example.test" });
    const staff = await session("narin.staff@example.test");
    const taken = await staff.agent.post(`/api/staff/tickets/${ticket.id}/claim`).set(staff.csrf).send({ version: 0 });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("TICKET_ALREADY_ASSIGNED");
    const fresh = await makeTicket();
    const stale = await staff.agent.post(`/api/staff/tickets/${fresh.id}/claim`).set(staff.csrf).send({ version: 5 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_TICKET");
    expect((await staff.agent.post(`/api/staff/tickets/${fresh.id}/claim`).set(staff.csrf).send({ version: -1 })).status).toBe(422);
    expect((await staff.agent.post(`/api/staff/tickets/${fresh.id}/claim`).set(staff.csrf).send({ version: 0, ownerId: 1 })).status).toBe(400);
    expect((await staff.agent.post(`/api/staff/tickets/${MISSING_ID}/claim`).set(staff.csrf).send({ version: 0 })).status).toBe(404);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: fresh.id } })).ownerId).toBeNull();
  });

  it("lets only one of several concurrent claims win", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    const results = await Promise.all([1, 2, 3].map(() => staff.agent.post(`/api/staff/tickets/${ticket.id}/claim`).set(staff.csrf).send({ version: 0 })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it("assigns and reassigns only to active IT Staff or Administrators, with confirmation for replacement", async () => {
    const staff = await session("narin.staff@example.test");
    const kanda = await prisma.user.findUniqueOrThrow({ where: { email: "kanda.staff@example.test" } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "araya.admin@example.test" } });
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } });
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: "wichai.inactive.staff@example.test" } });
    const ticket = await makeTicket();
    const assigned = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/owner`).set(staff.csrf).send({ ownerId: kanda.id, version: 0 });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.owner.id).toBe(kanda.id);
    const unconfirmed = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/owner`).set(staff.csrf).send({ ownerId: admin.id, version: 1 });
    expect(unconfirmed.status).toBe(422);
    expect(unconfirmed.body.error.fields.confirmed).toBeTruthy();
    const reassigned = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/owner`).set(staff.csrf).send({ ownerId: admin.id, version: 1, confirmed: true });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.data.owner.role).toBe("ADMINISTRATOR");
    for (const ownerId of [inactive.id, requester.id, 999999, 0, "7", null]) {
      const bad = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/owner`).set(staff.csrf).send({ ownerId, version: 2, confirmed: true });
      expect(bad.status, String(ownerId)).toBe(422);
      expect(bad.body.error.fields.ownerId).toBeTruthy();
    }
    expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/owner`).set(staff.csrf).send({ ownerId: kanda.id, version: 0, confirmed: true })).body.error.code).toBe("STALE_TICKET");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBe(admin.id);
  });

  it("lists active IT Staff and Administrators for Staff only", async () => {
    const staff = await session("narin.staff@example.test");
    const response = await staff.agent.get("/api/staff/assignees");
    expect(response.status).toBe(200);
    const names = response.body.data.map((u: { displayName: string }) => u.displayName);
    expect(names).toContain("Narin Support");
    expect(names).toContain("Araya Admin");
    expect(names).not.toContain("Wichai Support");
    expect(names).not.toContain("Anan Chai");
    expect([...names].sort()).toEqual(names);
    expect((await (await session("araya.admin@example.test")).agent.get("/api/staff/assignees")).status).toBe(403);
    expect((await (await session("anan@example.test")).agent.get("/api/staff/assignees")).status).toBe(403);
  });
});

describe("API-10 IT Priority", () => {
  it("changes IT Priority without touching Requested Priority and records actor/time", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    const response = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set(staff.csrf).send({ itPriority: "HIGH", version: 0 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ itPriority: "HIGH", requestedPriority: "LOW", version: 1 });
    expect(response.body.data.lastPriorityChangedBy.displayName).toBe("Narin Support");
  });

  it("rejects invalid values, a Requested Priority field, stale versions, and other roles", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    for (const itPriority of ["URGENT", "high", 3, null]) expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set(staff.csrf).send({ itPriority, version: 0 })).status).toBe(422);
    expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set(staff.csrf).send({ itPriority: "HIGH", requestedPriority: "HIGH", version: 0 })).status).toBe(400);
    expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set(staff.csrf).send({ itPriority: "HIGH", version: 9 })).body.error.code).toBe("STALE_TICKET");
    const noCsrf = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set("Origin", origin).send({ itPriority: "HIGH", version: 0 });
    expect(noCsrf.status).toBe(403);
    for (const email of ["anan@example.test", "araya.admin@example.test"]) {
      const other = await session(email);
      expect((await other.agent.patch(`/api/staff/tickets/${ticket.id}/it-priority`).set(other.csrf).send({ itPriority: "HIGH", version: 0 })).status).toBe(403);
    }
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.itPriority).toBe("LOW");
  });
});

describe("API-10 status transitions", () => {
  const confirmationRows: [Status, Status][] = [["NEW", "CANCELLED"], ["OPEN", "CANCELLED"], ["IN_PROGRESS", "RESOLVED"], ["RESOLVED", "CLOSED"], ["CLOSED", "REOPENED"]];

  it("applies a direct transition without confirmation and records actor/time", async () => {
    const ticket = await makeTicket({ status: "NEW" });
    const staff = await session("narin.staff@example.test");
    const response = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: "OPEN", version: 0 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ currentStatus: "OPEN", version: 1 });
    expect(response.body.data.lastStatusChangedBy.displayName).toBe("Narin Support");
  });

  it("requires confirmation for Resolved, Closed, Cancelled, and Reopened", async () => {
    const staff = await session("narin.staff@example.test");
    for (const [from, to] of confirmationRows) {
      const ticket = await makeTicket({ status: from, ownerEmail: "narin.staff@example.test" });
      const missing = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: to, version: 0 });
      expect(missing.status, `${from}>${to}`).toBe(422);
      expect(missing.body.error.fields.confirmed).toBeTruthy();
      const ok = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: to, version: 0, confirmed: true });
      expect(ok.status, `${from}>${to}`).toBe(200);
      expect(ok.body.data.currentStatus).toBe(to);
    }
  });

  it("checks every source/target pair against the matrix", async () => {
    const staff = await session("narin.staff@example.test");
    for (const from of TICKET_STATUSES) {
      const ticket = await makeTicket({ status: from, ownerEmail: "narin.staff@example.test" });
      let version = 0;
      for (const to of TICKET_STATUSES) {
        const allowed = Boolean(transitionRule(from, to));
        if (allowed) continue;
        const response = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: to, version, confirmed: true });
        expect(response.status, `${from}>${to}`).toBe(409);
        expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");
      }
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(stored.currentStatus).toBe(from);
      expect(stored.version).toBe(0);
    }
  });

  it("requires an eligible owner for owner-required transitions", async () => {
    const staff = await session("narin.staff@example.test");
    const noOwner = await makeTicket({ status: "OPEN" });
    const blocked = await staff.agent.patch(`/api/staff/tickets/${noOwner.id}/status`).set(staff.csrf).send({ status: "IN_PROGRESS", version: 0 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("OWNER_REQUIRED");
    const reopen = await makeTicket({ status: "CLOSED" });
    expect((await staff.agent.patch(`/api/staff/tickets/${reopen.id}/status`).set(staff.csrf).send({ status: "REOPENED", version: 0, confirmed: true })).status).toBe(200);
  });

  it("clears the requester signal when moving back to work or reopening, but not on other transitions", async () => {
    const staff = await session("narin.staff@example.test");
    const waiting = await makeTicket({ status: "WAITING_FOR_REQUESTER", ownerEmail: "narin.staff@example.test", signal: true });
    const back = await staff.agent.patch(`/api/staff/tickets/${waiting.id}/status`).set(staff.csrf).send({ status: "IN_PROGRESS", version: 0 });
    expect(back.status).toBe(200);
    expect(back.body.data.requesterResolvedAt).toBeNull();
    expect(back.body.data.requesterResolvedBy).toBeNull();
    const resolved = await makeTicket({ status: "WAITING_FOR_REQUESTER", ownerEmail: "narin.staff@example.test", signal: true });
    const done = await staff.agent.patch(`/api/staff/tickets/${resolved.id}/status`).set(staff.csrf).send({ status: "RESOLVED", version: 0, confirmed: true });
    expect(done.body.data.currentStatus).toBe("RESOLVED");
    expect(done.body.data.requesterResolvedAt).toBeTruthy();
    const reopened = await staff.agent.patch(`/api/staff/tickets/${resolved.id}/status`).set(staff.csrf).send({ status: "REOPENED", version: 1, confirmed: true });
    expect(reopened.body.data.requesterResolvedAt).toBeNull();
  });

  it("rejects unknown targets, stale versions, malformed bodies, and non-Staff roles without changing state", async () => {
    const ticket = await makeTicket({ status: "NEW" });
    const staff = await session("narin.staff@example.test");
    for (const status of ["DONE", "open", 5, null]) expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status, version: 0 })).status).toBe(422);
    expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: "OPEN", version: 3 })).body.error.code).toBe("STALE_TICKET");
    expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: "OPEN", version: 0, confirmed: "yes" })).status).toBe(422);
    expect((await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: "OPEN", version: 0, owner: 1 })).status).toBe(400);
    expect((await staff.agent.patch(`/api/staff/tickets/${MISSING_ID}/status`).set(staff.csrf).send({ status: "OPEN", version: 0 })).status).toBe(404);
    for (const email of ["anan@example.test", "araya.admin@example.test"]) {
      const other = await session(email);
      expect((await other.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(other.csrf).send({ status: "RESOLVED", version: 0, confirmed: true })).status).toBe(403);
    }
    expect((await request(app).patch(`/api/staff/tickets/${ticket.id}/status`).set("Origin", origin).send({ status: "OPEN", version: 0 })).status).toBe(401);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored).toMatchObject({ currentStatus: "NEW", version: 0 });
  });

  it("lets only one of several concurrent identical transitions win", async () => {
    const ticket = await makeTicket({ status: "NEW" });
    const staff = await session("narin.staff@example.test");
    const results = await Promise.all([1, 2, 3].map(() => staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set(staff.csrf).send({ status: "OPEN", version: 0 })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });
});

describe("API-11 Internal Notes for Staff and Administrators", () => {
  it("lets Staff create and read notes with backend author/time, and Administrators read but not create", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    const posted = await staff.agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set(staff.csrf).send({ content: "  Checked logs.\nNothing sensitive.  " });
    expect(posted.status).toBe(201);
    expect(posted.body.data).toMatchObject({ content: "Checked logs.\nNothing sensitive.", author: { displayName: "Narin Support" } });
    expect(Object.keys(posted.body.data).sort()).toEqual(["author", "content", "createdAt", "id"]);
    const read = await staff.agent.get(`/api/staff/tickets/${ticket.id}/internal-notes`);
    expect(read.body.data).toHaveLength(1);
    const admin = await session("araya.admin@example.test");
    expect((await admin.agent.get(`/api/staff/tickets/${ticket.id}/internal-notes`)).body.data).toHaveLength(1);
    expect((await admin.agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set(admin.csrf).send({ content: "No" })).status).toBe(403);
    expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it("validates notes, rejects forged fields, and has no edit or delete endpoint", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    for (const content of ["", "  \n ", "x".repeat(2001), 5]) {
      const response = await staff.agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set(staff.csrf).send({ content });
      expect(response.status).toBe(422);
      expect(response.body.error.fields.content).toBeTruthy();
    }
    expect((await staff.agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set(staff.csrf).send({ content: "ok", authorId: 1 })).status).toBe(400);
    expect((await staff.agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set("Origin", origin).send({ content: "ok" })).status).toBe(403);
    expect((await staff.agent.post(`/api/staff/tickets/${MISSING_ID}/internal-notes`).set(staff.csrf).send({ content: "ok" })).status).toBe(404);
    const note = await staff.agent.post(`/api/staff/tickets/${ticket.id}/internal-notes`).set(staff.csrf).send({ content: "keep me" });
    for (const method of ["patch", "put", "delete"] as const) {
      const response = await staff.agent[method](`/api/staff/tickets/${ticket.id}/internal-notes/${note.body.data.id}`).set(staff.csrf).send({ content: "changed" });
      expect([404, 501]).toContain(response.status);
    }
    expect((await prisma.internalNote.findUniqueOrThrow({ where: { id: note.body.data.id } })).content).toBe("keep me");
  });

  it("returns 403 to Requesters before any lookup, even for a missing ticket", async () => {
    const requester = await session("anan@example.test");
    const missing = await requester.agent.get(`/api/staff/tickets/${MISSING_ID}/internal-notes`);
    const real = await requester.agent.get(`/api/staff/tickets/${(await makeTicket()).id}/internal-notes`);
    expect(missing.status).toBe(403);
    expect(real.body).toEqual(missing.body);
  });
});

describe("API-05 Staff Public Comments from the detail workflow", () => {
  it("lets Staff comment, lets the owning Requester read it, and keeps Administrator read-only", async () => {
    const ticket = await makeTicket();
    const staff = await session("narin.staff@example.test");
    const posted = await staff.agent.post(`/api/tickets/${ticket.id}/comments`).set(staff.csrf).send({ content: "Please retry <b>now</b>." });
    expect(posted.status).toBe(201);
    const requester = await session("anan@example.test");
    const read = await requester.agent.get(`/api/tickets/${ticket.id}/comments`);
    expect(read.body.data[0].content).toBe("Please retry <b>now</b>.");
    const admin = await session("araya.admin@example.test");
    expect((await admin.agent.get(`/api/tickets/${ticket.id}/comments`)).status).toBe(200);
    expect((await admin.agent.post(`/api/tickets/${ticket.id}/comments`).set(admin.csrf).send({ content: "no" })).status).toBe(403);
  });
});
