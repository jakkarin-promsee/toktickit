import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { TICKET_STATUSES } from "../../src/staff-query.js";
import { transitionRule } from "../../src/status-transitions.js";
import { csrfHeaders } from "../lab-03/requester-test-session.js";

const prisma = getPrisma();
const ids: string[] = [];
let ownerId: number;
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;
const origin = "http://localhost:5173";

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password: process.env.LAB3_SEED_INITIAL_PASSWORD });
  expect(response.status).toBe(200);
  return { agent, headers: csrfHeaders(response.body.data.csrfToken as string) };
}

async function ticket(status: (typeof TICKET_STATUSES)[number] = "IN_PROGRESS", owner = ownerId) {
  const row = await prisma.ticket.create({ data: { ticketNumber: `TKT-${Date.now()}-${Math.floor(Math.random() * 99999)}`.slice(0, 19), submittedByUserId: requesterId, categoryId, relatedSystemId, ownerId: owner, summary: "Workflow test", description: "Workflow test", requestedPriority: "LOW", itPriority: "LOW", currentStatus: status } });
  ids.push(row.id);
  return row;
}

async function completed(ticketId: string, version: number) {
  return prisma.actionTaken.create({ data: { ticketId, actionAt: new Date(), description: "Repair", result: "Restored", status: "COMPLETED", createdByUserId: ownerId, performedByUserId: ownerId, assigneeId: ownerId, followUpRequired: false, completedAt: new Date(), completedByUserId: ownerId, completedTicketVersion: version } });
}

beforeAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: ["anan@example.test", "narin.staff@example.test", "araya.admin@example.test"] } }, data: { mustChangePassword: false } });
  ownerId = (await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } })).id;
  requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } })).id;
  categoryId = (await prisma.category.findFirstOrThrow()).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow()).id;
});

afterAll(async () => {
  await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.actionEvent.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.actionCreateRequest.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.updateMany({ where: { email: { in: ["anan@example.test", "narin.staff@example.test", "araya.admin@example.test"] } }, data: { mustChangePassword: true } });
  await prisma.$disconnect();
});

describe("Ticket workflow API", () => {
  it("accepts every approved transition with its required confirmation and completed work", async () => {
    const staff = await login("narin.staff@example.test");
    let count = 0;
    for (const from of TICKET_STATUSES) for (const to of TICKET_STATUSES) {
      const rule = transitionRule(from, to);
      if (!rule) continue;
      const row = await ticket(from);
      if (to === "RESOLVED") await completed(row.id, 0);
      const response = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: to, version: 0, ...(rule.confirmationRequired ? { confirmed: true } : {}) });
      expect(response.status, `${from}>${to}`).toBe(200);
      expect(response.body.data.currentStatus).toBe(to);
      count++;
    }
    expect(count).toBe(19);
  });

  it("rejects every omitted transition through the API without writing history", async () => {
    const staff = await login("narin.staff@example.test");
    for (const from of TICKET_STATUSES) {
      const row = await ticket(from);
      for (const to of TICKET_STATUSES) {
        if (transitionRule(from, to)) continue;
        const response = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: to, version: 0, confirmed: true });
        expect(response.body.error.code, `${from}>${to}`).toBe("INVALID_STATUS_TRANSITION");
      }
      expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
    }
  });

  it("blocks zero-action resolution and preserves status, version, and history", async () => {
    const row = await ticket();
    const staff = await login("narin.staff@example.test");
    const response = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: "RESOLVED", version: 0, confirmed: true });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "RESOLUTION_ACTION_REQUIRED", message: "Complete an action for this Ticket before resolving it." });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(0);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
  });

  it("rejects planned and cancelled Actions, while a legacy Resolved Ticket can close", async () => {
    const row = await ticket();
    await prisma.actionTaken.create({ data: { ticketId: row.id, actionAt: new Date(), description: "Not finished", status: "PLANNED", createdByUserId: ownerId, performedByUserId: ownerId, followUpRequired: false } });
    await prisma.actionTaken.create({ data: { ticketId: row.id, actionAt: new Date(), description: "Abandoned", status: "CANCELLED", createdByUserId: ownerId, performedByUserId: ownerId, followUpRequired: false, cancelledAt: new Date(), cancelledByUserId: ownerId, cancellationReason: "No longer needed" } });
    const staff = await login("narin.staff@example.test");
    const blocked = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: "RESOLVED", version: 0, confirmed: true });
    expect(blocked.body.error.code).toBe("RESOLUTION_ACTION_REQUIRED");
    const legacy = await ticket("RESOLVED");
    await prisma.ticketWorkflowEvent.create({ data: { ticketId: legacy.id, type: "BASELINE", actorId: null, resultingTicketVersion: 0, changes: { currentStatus: { before: null, after: "RESOLVED" } } } });
    const closed = await staff.agent.patch(`/api/staff/tickets/${legacy.id}/status`).set(staff.headers).send({ status: "CLOSED", version: 0, confirmed: true });
    expect(closed.status).toBe(200);
    const history = await staff.agent.get(`/api/staff/tickets/${legacy.id}/workflow-events`);
    expect(history.body.data.map((event: { type: string }) => event.type)).toEqual(["BASELINE", "STATUS_CHANGED"]);
    expect(history.body.data[0].actor).toBeNull();
  });

  it("resolves with qualifying completed work, records actor and history, and rejects a stale retry", async () => {
    const row = await ticket();
    await completed(row.id, 0);
    const staff = await login("narin.staff@example.test");
    const body = { status: "RESOLVED", version: 0, confirmed: true };
    const responses = await Promise.all([1, 2].map(() => staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send(body)));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const good = responses.find((r) => r.status === 200)!;
    expect(good.body.data).toMatchObject({ currentStatus: "RESOLVED", version: 1 });
    expect(good.body.data.lastStatusChangedBy.id).toBe(ownerId);
    expect(good.body.data.lastStatusChangedAt).toBeTruthy();
    const events = await staff.agent.get(`/api/staff/tickets/${row.id}/workflow-events`);
    expect(events.body.data).toHaveLength(1);
    expect(events.body.data[0]).toMatchObject({ type: "STATUS_CHANGED", resultingTicketVersion: 1, actor: { id: ownerId }, changes: { currentStatus: { before: "IN_PROGRESS", after: "RESOLVED" } } });
    await expect((await login("anan@example.test")).agent.get(`/api/staff/tickets/${row.id}/workflow-events`).then((r) => r.status)).resolves.toBe(403);
  });

  it("requires a new completed action after reopen and keeps earlier events", async () => {
    const row = await ticket("RESOLVED");
    await completed(row.id, 0);
    const staff = await login("narin.staff@example.test");
    const reopened = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: "REOPENED", version: 0, confirmed: true });
    expect(reopened.status).toBe(200);
    const blocked = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: "RESOLVED", version: 1, confirmed: true });
    expect(blocked.body.error.code).toBe("RESOLUTION_ACTION_REQUIRED");
    const created = await staff.agent.post(`/api/tickets/${row.id}/actions`).set(staff.headers).set("Idempotency-Key", crypto.randomUUID()).send({ ticketVersion: 1, actionAt: new Date().toISOString(), description: "Repair after reopen", result: "Restored", assigneeId: ownerId, followUpRequired: false, followUpNote: null, attachmentNotes: null });
    expect(created.status).toBe(201);
    const finished = await staff.agent.patch(`/api/tickets/${row.id}/actions/${created.body.data.id}/status`).set(staff.headers).send({ ticketVersion: created.body.data.ticketVersion, actionVersion: 0, status: "COMPLETED" });
    expect(finished.status).toBe(200);
    const resolved = await staff.agent.patch(`/api/staff/tickets/${row.id}/status`).set(staff.headers).send({ status: "RESOLVED", version: finished.body.data.ticketVersion, confirmed: true });
    expect(resolved.status).toBe(200);
    const history = await staff.agent.get(`/api/staff/tickets/${row.id}/workflow-events`);
    expect(history.body.data.map((event: { type: string }) => event.type)).toEqual(["STATUS_CHANGED", "ACTION_CHANGED", "ACTION_CHANGED", "STATUS_CHANGED"]);
    expect(history.body.data.map((event: { resultingTicketVersion: number }) => event.resultingTicketVersion)).toEqual([1, 2, 3, 4]);
  });
});
