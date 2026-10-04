import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders, requesterSession } from "./requester-test-session.js";

const prisma = getPrisma();
const createdTicketIds: string[] = [];
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;
const origin = "http://localhost:5173";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

let ananTicketId: string;
let maliTicketId: string;

async function makeTicket(email: string, status: "NEW" | "WAITING_FOR_REQUESTER" = "NEW") {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();
  const count = await prisma.ticket.count();
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-20261004-9${String(count).padStart(5, "0")}`,
      submittedByUserId: user.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: "Comment test ticket",
      description: "Created by the comments API test.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: status,
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket;
}

async function staffSession() {
  const email = "narin.staff@example.test";
  await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password: initialPassword });
  expect(login.status).toBe(200);
  return { agent, csrfToken: login.body.data.csrfToken as string };
}

async function adminSession() {
  const email = "araya.admin@example.test";
  await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password: initialPassword });
  expect(login.status).toBe(200);
  return { agent, csrfToken: login.body.data.csrfToken as string };
}

beforeAll(async () => {
  ananTicketId = (await makeTicket("anan@example.test")).id;
  maliTicketId = (await makeTicket("mali@example.test")).id;
});

afterAll(async () => {
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.user.updateMany({
    where: { email: { in: ["anan@example.test", "mali@example.test", "narin.staff@example.test", "araya.admin@example.test"] } },
    data: { mustChangePassword: true },
  });
  await prisma.$disconnect();
});

describe("API-05 Public Comments for Requesters", () => {
  it("lets the owner post a valid comment with backend-controlled author and time", async () => {
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const before = Date.now();
    const response = await agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(csrfToken)).send({ content: "  The VPN still fails.\nSecond line  " });
    expect(response.status).toBe(201);
    expect(response.body.data.content).toBe("The VPN still fails.\nSecond line");
    expect(response.body.data.author.displayName).toBe("Anan Chai");
    expect(Date.parse(response.body.data.createdAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Object.keys(response.body.data).sort()).toEqual(["author", "content", "createdAt", "id"]);
  });

  it("rejects client-supplied author or timestamp fields", async () => {
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    for (const extra of [{ authorId: 2 }, { createdAt: "2000-01-01T00:00:00Z" }, { html: true }]) {
      const response = await agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(csrfToken)).send({ content: "Hello", ...extra });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MALFORMED_REQUEST");
    }
  });

  it("rejects empty, whitespace-only, missing, non-string, and over-limit content with field errors", async () => {
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    for (const content of ["", "   \n\t ", "x".repeat(2001), 42, null]) {
      const response = await agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(csrfToken)).send({ content });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields.content).toBeTruthy();
    }
    const boundary = await agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(csrfToken)).send({ content: "y".repeat(2000) });
    expect(boundary.status).toBe(201);
  });

  it("requires Origin and CSRF for posting and a valid ticket id", async () => {
    const { agent } = await requesterSession("anan@example.test");
    const noCsrf = await agent.post(`/api/tickets/${ananTicketId}/comments`).set("Origin", origin).send({ content: "Hi" });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");
    const { agent: other, csrfToken } = await requesterSession("anan@example.test");
    const bad = await other.post("/api/tickets/not-a-uuid/comments").set(csrfHeaders(csrfToken)).send({ content: "Hi" });
    expect(bad.status).toBe(400);
  });

  it("returns owned comments in chronological order and stores HTML-like text literally", async () => {
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const markup = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const posted = await agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(csrfToken)).send({ content: markup });
    expect(posted.status).toBe(201);
    const list = await agent.get(`/api/tickets/${ananTicketId}/comments`);
    expect(list.status).toBe(200);
    const times = list.body.data.map((comment: { createdAt: string }) => Date.parse(comment.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(list.body.data.some((comment: { content: string }) => comment.content === markup)).toBe(true);
  });

  it("gives identical 404 responses for missing and other-owner tickets on read and write", async () => {
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const readMissing = await agent.get(`/api/tickets/${MISSING_ID}/comments`);
    const readOther = await agent.get(`/api/tickets/${maliTicketId}/comments`);
    expect(readOther.status).toBe(404);
    expect(readOther.body).toEqual(readMissing.body);
    const writeMissing = await agent.post(`/api/tickets/${MISSING_ID}/comments`).set(csrfHeaders(csrfToken)).send({ content: "Hi" });
    const writeOther = await agent.post(`/api/tickets/${maliTicketId}/comments`).set(csrfHeaders(csrfToken)).send({ content: "Hi" });
    expect(writeOther.status).toBe(404);
    expect(writeOther.body).toEqual(writeMissing.body);
    expect(await prisma.publicComment.count({ where: { ticketId: maliTicketId } })).toBe(0);
  });

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/tickets/${ananTicketId}/comments`)).status).toBe(401);
    expect((await request(app).post(`/api/tickets/${ananTicketId}/comments`).set("Origin", origin).send({ content: "Hi" })).status).toBe(401);
  });
});

describe("API-05 Public Comments for other roles", () => {
  it("lets IT Staff comment on any ticket, Administrators read but not comment", async () => {
    const staff = await staffSession();
    const posted = await staff.agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(staff.csrfToken)).send({ content: "We are looking into it." });
    expect(posted.status).toBe(201);
    expect(posted.body.data.author.displayName).toBe("Narin Support");
    const admin = await adminSession();
    const read = await admin.agent.get(`/api/tickets/${ananTicketId}/comments`);
    expect(read.status).toBe(200);
    expect(read.body.data.some((comment: { content: string }) => comment.content === "We are looking into it.")).toBe(true);
    const denied = await admin.agent.post(`/api/tickets/${ananTicketId}/comments`).set(csrfHeaders(admin.csrfToken)).send({ content: "Nope" });
    expect(denied.status).toBe(403);
    const staffMissing = await staff.agent.get(`/api/tickets/${MISSING_ID}/comments`);
    expect(staffMissing.status).toBe(404);
  });

  it("lets the Requester see the Staff comment on the owned ticket", async () => {
    const { agent } = await requesterSession("anan@example.test");
    const list = await agent.get(`/api/tickets/${ananTicketId}/comments`);
    expect(list.body.data.some((comment: { author: { displayName: string } }) => comment.author.displayName === "Narin Support")).toBe(true);
  });
});

describe("API-11 Requester cannot reach Internal Notes", () => {
  it("rejects reads and writes without exposing note content", async () => {
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const read = await agent.get(`/api/staff/tickets/${ananTicketId}/internal-notes`);
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe("FORBIDDEN");
    const write = await agent.post(`/api/staff/tickets/${ananTicketId}/internal-notes`).set(csrfHeaders(csrfToken)).send({ content: "secret" });
    expect(write.status).toBe(403);
    expect(await prisma.internalNote.count({ where: { ticketId: ananTicketId } })).toBe(0);
  });

  it("never includes notes in the Requester Ticket Detail or comment list", async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } });
    await prisma.internalNote.create({ data: { ticketId: ananTicketId, authorId: staff.id, content: "INTERNAL-ONLY-MARKER" } });
    const { agent } = await requesterSession("anan@example.test");
    const detail = await agent.get(`/api/tickets/${ananTicketId}`);
    const comments = await agent.get(`/api/tickets/${ananTicketId}/comments`);
    expect(JSON.stringify(detail.body)).not.toContain("INTERNAL-ONLY-MARKER");
    expect(JSON.stringify(comments.body)).not.toContain("INTERNAL-ONLY-MARKER");
    expect(detail.body.data).not.toHaveProperty("internalNotes");
  });
});
