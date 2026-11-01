import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";

const prisma = getPrisma();
async function login(email: string) { const user = await prisma.user.update({ where: { email }, data: { mustChangePassword: false } }); await prisma.credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(process.env.LAB3_SEED_INITIAL_PASSWORD!) } }); const agent = request.agent(app); const response = await agent.post("/api/auth/login").set("Origin", "http://localhost:5173").send({ email, password: process.env.LAB3_SEED_INITIAL_PASSWORD }); expect(response.status).toBe(200); return { agent, user }; }
afterAll(async () => { await prisma.user.updateMany({ where: { email: { in: ["narin.staff@example.test", "kanda.staff@example.test", "araya.admin@example.test"] } }, data: { mustChangePassword: true } }); await prisma.$disconnect(); });

describe("Staff dashboard API", () => {
  it("matches active ownership and assigned Action counts with zero buckets", async () => {
    const { agent, user } = await login("narin.staff@example.test");
    const response = await agent.get("/api/dashboard/staff"); expect(response.status).toBe(200);
    const data = response.body.data;
    const active = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
    expect(data.cards.unassignedTickets).toBe(await prisma.ticket.count({ where: { ownerId: null, currentStatus: { in: [...active] } } }));
    expect(data.cards.myTickets).toBe(await prisma.ticket.count({ where: { ownerId: user.id, currentStatus: { in: [...active] } } }));
    expect(data.cards.myActiveActions).toBe(await prisma.actionTaken.count({ where: { assigneeId: user.id, status: { in: ["PLANNED", "IN_PROGRESS"] }, ticket: { currentStatus: { in: [...active] } } } }));
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const) expect(data.byStatus[status]).toBe(await prisma.ticket.count({ where: { currentStatus: status } }));
    for (const priority of ["LOW", "MEDIUM", "HIGH"] as const) expect(data.byItPriority[priority]).toBe(await prisma.ticket.count({ where: { itPriority: priority } }));
    const recent = await prisma.ticket.findMany({ where: { updatedAt: { gte: new Date(data.windowStart), lte: new Date(data.asOf) } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } });
    const urgent = await prisma.ticket.findMany({ where: { itPriority: "HIGH", currentStatus: { in: [...active] } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } });
    expect(data.recentTickets.map((item: { id: string }) => item.id)).toEqual(recent.map((item) => item.id));
    expect(data.urgentTickets.map((item: { id: string }) => item.id)).toEqual(urgent.map((item) => item.id));
    expect(data.myActions.every((action: { status: string }) => ["PLANNED", "IN_PROGRESS"].includes(action.status))).toBe(true);
    expect((await agent.get("/api/staff/tickets?view=my-active-actions")).status).toBe(200);
    expect((await agent.get("/api/staff/tickets?view=urgent&requestedPriority=HIGH")).body.error.code).toBe("INVALID_QUERY");
    expect((await agent.get("/api/dashboard/staff?userId=1")).body.error.code).toBe("INVALID_QUERY");
  });
  it("allows Administrator operational reads with self-scoped My metrics", async () => {
    const { agent, user } = await login("araya.admin@example.test");
    const response = await agent.get("/api/dashboard/staff"); expect(response.status).toBe(200);
    expect(response.body.data.cards.myTickets).toBe(await prisma.ticket.count({ where: { ownerId: user.id, currentStatus: { in: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] } } }));
    expect(response.body.data).not.toHaveProperty("accountCounts");
  });
  it("counts each active assigned Action and orders the current user's list", async () => {
    const { agent, user } = await login("kanda.staff@example.test");
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { currentStatus: "OPEN" } });
    const first = await prisma.actionTaken.create({ data: { ticketId: ticket.id, actionAt: new Date("2026-11-01T01:00:00.000Z"), description: "First assigned action", status: "PLANNED", createdByUserId: user.id, performedByUserId: user.id, assigneeId: user.id } });
    const second = await prisma.actionTaken.create({ data: { ticketId: ticket.id, actionAt: new Date("2026-11-01T02:00:00.000Z"), description: "Second assigned action", status: "IN_PROGRESS", createdByUserId: user.id, performedByUserId: user.id, assigneeId: user.id } });
    try {
      const response = await agent.get("/api/dashboard/staff"); expect(response.status).toBe(200);
      expect(response.body.data.cards.myActiveActions).toBeGreaterThanOrEqual(2);
      expect(response.body.data.myActions.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([first.id, second.id]));
      expect(response.body.data.myActions.findIndex((item: { id: string }) => item.id === first.id)).toBeLessThan(response.body.data.myActions.findIndex((item: { id: string }) => item.id === second.id));
      const queue = await agent.get("/api/staff/tickets?view=my-active-actions"); expect(queue.status).toBe(200);
      expect(queue.body.data.find((item: { id: string }) => item.id === ticket.id).matchingActionCount).toBeGreaterThanOrEqual(2);
    } finally { await prisma.actionTaken.deleteMany({ where: { id: { in: [first.id, second.id] } } }); }
  });
});
