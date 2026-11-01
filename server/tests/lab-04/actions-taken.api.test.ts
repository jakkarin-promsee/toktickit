import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";

const prisma = getPrisma();
const origin = "http://localhost:5173";
const password = process.env.LAB3_SEED_INITIAL_PASSWORD!;
let ticketId: string;
let ownerId: number;
let otherId: number;

async function login(email: string) {
  const user = await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
  await prisma.credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(password) } });
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password });
  expect(response.status).toBe(200);
  return { agent, headers: { Origin: origin, "X-CSRF-Token": response.body.data.csrfToken as string } };
}

async function createAction(agent: ReturnType<typeof request.agent>, headers: Record<string, string>, actorTicketId = ticketId, overrides: Record<string, unknown> = {}) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: actorTicketId } });
  return agent.post(`/api/tickets/${actorTicketId}/actions`).set(headers).set("Idempotency-Key", crypto.randomUUID()).send({ ticketVersion: ticket.version, actionAt: new Date(ticket.createdAt.getTime() + 120_000).toISOString(), description: "Diagnose the connection", result: "", assigneeId: ownerId, followUpRequired: false, followUpNote: null, attachmentNotes: null, ...overrides });
}

beforeAll(async () => {
  const requester = await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } });
  ownerId = (await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } })).id;
  otherId = (await prisma.user.findUniqueOrThrow({ where: { email: "kanda.staff@example.test" } })).id;
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-${Date.now()}-${Math.floor(Math.random() * 100000)}`.slice(0, 19), submittedByUserId: requester.id, categoryId: category.id, relatedSystemId: system.id, ownerId, summary: "Action API test", description: "Test ticket", requestedPriority: "LOW", itPriority: "LOW", currentStatus: "OPEN" } });
  ticketId = ticket.id;
});

afterAll(async () => {
  await prisma.actionCreateRequest.deleteMany({ where: { ticketId } });
  await prisma.actionEvent.deleteMany({ where: { ticketId } });
  await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId } });
  await prisma.actionTaken.deleteMany({ where: { ticketId } });
  await prisma.ticket.delete({ where: { id: ticketId } });
  await prisma.user.updateMany({ where: { email: { in: ["anan@example.test", "mali@example.test", "narin.staff@example.test", "kanda.staff@example.test", "araya.admin@example.test"] } }, data: { mustChangePassword: true } });
  await prisma.$disconnect();
});

describe("Actions Taken API", () => {
  it("creates under a Ticket, records authenticated performer, replays idempotently, and returns stable role views", async () => {
    const staff = await login("narin.staff@example.test");
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const body = { ticketVersion: ticket.version, actionAt: new Date(ticket.createdAt.getTime() + 120_000).toISOString(), description: "  Check access point  ", result: "", assigneeId: otherId, followUpRequired: true, followUpNote: "  Recheck tomorrow  ", attachmentNotes: null };
    const key = crypto.randomUUID();
    const create = await staff.agent.post(`/api/tickets/${ticketId}/actions`).set(staff.headers).set("Idempotency-Key", key).send(body);
    expect(create.status).toBe(201);
    expect(create.body.data.performedBy.id).toBe(ownerId);
    expect(create.body.data.assignee.id).toBe(otherId);
    expect(create.body.data.description).toBe("Check access point");
    const replay = await staff.agent.post(`/api/tickets/${ticketId}/actions`).set(staff.headers).set("Idempotency-Key", key).send(body);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(create.body);
    const changed = await staff.agent.post(`/api/tickets/${ticketId}/actions`).set(staff.headers).set("Idempotency-Key", key).send({ ...body, description: "Changed" });
    expect(changed.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    const requester = await login("anan@example.test");
    const list = await requester.agent.get(`/api/tickets/${ticketId}/actions`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((a: { id: string }) => a.id === create.body.data.id)).toBe(true);
    const own = list.body.data.find((a: { id: string }) => a.id === create.body.data.id);
    expect(own.performedBy).toEqual({ displayName: "Narin Support" });
    expect(own).not.toHaveProperty("version");
    expect(own).not.toHaveProperty("cancellationReason");
    expect((await requester.agent.get(`/api/tickets/${ticketId}/actions/${create.body.data.id}/events`)).status).toBe(403);
    const events = await staff.agent.get(`/api/tickets/${ticketId}/actions/${create.body.data.id}/events`);
    expect(events.body.data.map((e: { type: string }) => e.type)).toEqual(["CREATED"]);
  });

  it("assigns, edits, starts and completes with version checks and audit events", async () => {
    const owner = await login("narin.staff@example.test");
    const other = await login("kanda.staff@example.test");
    const created = await createAction(owner.agent, owner.headers, ticketId, { assigneeId: null });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const assigned = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}/assignee`).set(owner.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 0, assigneeId: otherId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.performedBy.id).toBe(ownerId);
    const stale = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}/assignee`).set(owner.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 0, assigneeId: ownerId });
    expect(stale.body.error.code).toBe("STALE_TICKET");
    const edit = await other.agent.patch(`/api/tickets/${ticketId}/actions/${id}`).set(other.headers).send({ ticketVersion: assigned.body.data.ticketVersion, actionVersion: 1, actionAt: assigned.body.data.actionAt, description: "Replaced adapter", result: "Connection restored", followUpRequired: false, followUpNote: null, attachmentNotes: "Existing Ticket image" });
    expect(edit.status).toBe(200);
    const start = await other.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(other.headers).send({ ticketVersion: edit.body.data.ticketVersion, actionVersion: 2, status: "IN_PROGRESS" });
    expect(start.status).toBe(200);
    const complete = await other.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(other.headers).send({ ticketVersion: start.body.data.ticketVersion, actionVersion: 3, status: "COMPLETED" });
    expect(complete.status).toBe(200);
    expect(complete.body.data.completedBy.id).toBe(otherId);
    const terminal = await other.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(other.headers).send({ ticketVersion: complete.body.data.ticketVersion, actionVersion: 4, status: "CANCELLED", reason: "No" });
    expect(terminal.body.error.code).toBe("INVALID_ACTION_TRANSITION");
    const events = await other.agent.get(`/api/tickets/${ticketId}/actions/${id}/events`);
    expect(events.body.data.map((e: { type: string }) => e.type)).toEqual(["CREATED", "ASSIGNED", "EDITED", "STATUS_CHANGED", "COMPLETED"]);
  });

  it("rejects direct Requester writes, cross-owner reads, inactive assignees and protected fields", async () => {
    const requester = await login("anan@example.test");
    const body = { ticketVersion: 0, actionAt: new Date().toISOString(), description: "Bypass", assigneeId: ownerId, followUpRequired: false, followUpNote: null, attachmentNotes: null };
    const denied = await requester.agent.post(`/api/tickets/${ticketId}/actions`).set(requester.headers).set("Idempotency-Key", crypto.randomUUID()).send(body);
    expect(denied.status).toBe(403);
    const visible = await prisma.actionTaken.findFirstOrThrow({ where: { ticketId } });
    for (const suffix of ["", "/assignee", "/status"]) {
      const bypass = await requester.agent.patch(`/api/tickets/${ticketId}/actions/${visible.id}${suffix}`).set(requester.headers).send({ ticketVersion: 0, actionVersion: 0 });
      expect(bypass.status).toBe(403);
    }
    const otherRequester = await login("mali@example.test");
    expect((await otherRequester.agent.get(`/api/tickets/${ticketId}/actions`)).status).toBe(404);
    const staff = await login("narin.staff@example.test");
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: "wichai.inactive.staff@example.test" } });
    const invalid = await createAction(staff.agent, staff.headers, ticketId, { assigneeId: inactive.id });
    expect(invalid.body.error.code).toBe("INACTIVE_ASSIGNEE");
    const spoof = await createAction(staff.agent, staff.headers, ticketId, { performedByUserId: otherId });
    expect(spoof.status).toBe(400);
    const badNote = await createAction(staff.agent, staff.headers, ticketId, { followUpRequired: true, followUpNote: null });
    expect(badNote.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows a creator to cancel an unassigned Planned action and different staff to record separate work", async () => {
    const owner = await login("narin.staff@example.test");
    const other = await login("kanda.staff@example.test");
    const first = await createAction(owner.agent, owner.headers, ticketId, { assigneeId: null });
    const cancelled = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${first.body.data.id}/status`).set(owner.headers).send({ ticketVersion: first.body.data.ticketVersion, actionVersion: 0, status: "CANCELLED", reason: "Duplicate task" });
    expect(cancelled.status).toBe(200);
    const second = await createAction(other.agent, other.headers);
    expect(second.status).toBe(201);
    expect(second.body.data.performedBy.id).toBe(otherId);
    expect((await prisma.actionTaken.findMany({ where: { ticketId }, select: { performedByUserId: true } })).map((a) => a.performedByUserId)).toContain(ownerId);
  });

  it("detects an Action version collision, rejects invalid lifecycle changes, and permits Administrator Action writes", async () => {
    const staff = await login("narin.staff@example.test");
    const admin = await login("araya.admin@example.test");
    const created = await createAction(staff.agent, staff.headers, ticketId, { result: "Ready" });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    await prisma.actionTaken.update({ where: { id }, data: { version: { increment: 1 } } });
    const stale = await staff.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(staff.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 0, status: "COMPLETED" });
    expect(stale.body.error.code).toBe("STALE_ACTION");
    const invalid = await staff.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(staff.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 1, status: "PLANNED" });
    expect(invalid.body.error.code).toBe("INVALID_ACTION_TRANSITION");
    const adminCreated = await createAction(admin.agent, admin.headers, ticketId, { assigneeId: null });
    expect(adminCreated.status).toBe(201);
    expect(adminCreated.body.data.performedBy.role).toBe("ADMINISTRATOR");
    const deniedTicketMutation = await admin.agent.patch(`/api/staff/tickets/${ticketId}/status`).set(admin.headers).send({ status: "IN_PROGRESS", version: adminCreated.body.data.ticketVersion });
    expect(deniedTicketMutation.status).toBe(403);
  });

  it("supports reassignment and direct Planned-to-Completed, but requires a saved Result", async () => {
    const owner = await login("narin.staff@example.test");
    const created = await createAction(owner.agent, owner.headers, ticketId, { result: "" });
    const id = created.body.data.id as string;
    const noResult = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(owner.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 0, status: "COMPLETED" });
    expect(noResult.status).toBe(422);
    expect(noResult.body.error.fields.result).toBeTruthy();
    const reassigned = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}/assignee`).set(owner.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 0, assigneeId: otherId });
    expect(reassigned.status).toBe(200);
    const same = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}/assignee`).set(owner.headers).send({ ticketVersion: reassigned.body.data.ticketVersion, actionVersion: 1, assigneeId: otherId });
    expect(same.body.error.code).toBe("ASSIGNMENT_UNCHANGED");
    const edited = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}`).set(owner.headers).send({ ticketVersion: reassigned.body.data.ticketVersion, actionVersion: 1, actionAt: reassigned.body.data.actionAt, description: "Repaired connection", result: "Connection restored", followUpRequired: false, followUpNote: null, attachmentNotes: null });
    expect(edited.status).toBe(200);
    const completed = await owner.agent.patch(`/api/tickets/${ticketId}/actions/${id}/status`).set(owner.headers).send({ ticketVersion: edited.body.data.ticketVersion, actionVersion: 2, status: "COMPLETED" });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");
  });

  it("rejects malformed JSON and impossible dates, and keeps a retry from adding another Action", async () => {
    const staff = await login("narin.staff@example.test");
    const malformed = await staff.agent.post(`/api/tickets/${ticketId}/actions`).set(staff.headers).set("Content-Type", "application/json").set("Idempotency-Key", crypto.randomUUID()).send("{broken");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("MALFORMED_REQUEST");
    const impossible = await createAction(staff.agent, staff.headers, ticketId, { actionAt: "2026-02-30T10:00:00Z" });
    expect(impossible.body.error.fields.actionAt).toBeTruthy();
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const payload = { ticketVersion: ticket.version, actionAt: new Date(ticket.createdAt.getTime() + 120_000).toISOString(), description: "Safe retry", result: "", assigneeId: ownerId, followUpRequired: false, followUpNote: null, attachmentNotes: null };
    const key = crypto.randomUUID();
    const before = await prisma.actionTaken.count({ where: { ticketId } });
    const first = await staff.agent.post(`/api/tickets/${ticketId}/actions`).set(staff.headers).set("Idempotency-Key", key).send(payload);
    const retry = await staff.agent.post(`/api/tickets/${ticketId}/actions`).set(staff.headers).set("Idempotency-Key", key).send(payload);
    expect(first.status).toBe(201);
    expect(retry.body).toEqual(first.body);
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(before + 1);
  });
});
