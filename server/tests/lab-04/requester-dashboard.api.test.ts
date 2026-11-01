import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";

const prisma = getPrisma();
async function login(email: string) { const user = await prisma.user.update({ where: { email }, data: { mustChangePassword: false } }); await prisma.credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(process.env.LAB3_SEED_INITIAL_PASSWORD!) } }); const agent = request.agent(app); const response = await agent.post("/api/auth/login").set("Origin", "http://localhost:5173").send({ email, password: process.env.LAB3_SEED_INITIAL_PASSWORD }); expect(response.status).toBe(200); return { agent, user }; }
afterAll(async () => { await prisma.user.updateMany({ where: { email: "anan@example.test" }, data: { mustChangePassword: true } }); await prisma.$disconnect(); });

describe("Requester dashboard API", () => {
  it("matches owned database counts, list order and UTC boundary", async () => {
    const { agent, user } = await login("anan@example.test");
    const response = await agent.get("/api/dashboard/requester");
    expect(response.status).toBe(200);
    const data = response.body.data;
    const start = new Date(data.windowStart); const end = new Date(data.asOf);
    expect(start.getUTCHours()).toBe(0);
    expect((end.getTime() - start.getTime()) / 86400000).toBeGreaterThanOrEqual(6);
    const own = { submittedByUserId: user.id };
    expect(data.cards.openTickets).toBe(await prisma.ticket.count({ where: { ...own, currentStatus: { in: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] } } }));
    expect(data.cards.waitingForYou).toBe(await prisma.ticket.count({ where: { ...own, currentStatus: "WAITING_FOR_REQUESTER" } }));
    expect(data.cards.recentlyUpdated).toBe(await prisma.ticket.count({ where: { ...own, updatedAt: { gte: start, lte: end } } }));
    expect(data.cards.recentlyResolved).toBe(await prisma.ticket.count({ where: { ...own, currentStatus: "RESOLVED", lastStatusChangedAt: { gte: start, lte: end } } }));
    expect(data.recentTickets.map((item: { id: string }) => item.id)).toEqual((await prisma.ticket.findMany({ where: { ...own, updatedAt: { gte: start, lte: end } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } })).map((item) => item.id));
    expect(data.recentTickets.every((item: { id: string }) => item.id)).toBe(true);
    const other = await prisma.user.findUniqueOrThrow({ where: { email: "mali@example.test" } });
    expect(data.recentTickets.map((item: { id: string }) => item.id)).not.toContain((await prisma.ticket.findFirst({ where: { submittedByUserId: other.id } }))?.id);
    expect((await agent.get("/api/dashboard/requester?asOf=2026-10-01T00:00:00.000Z")).body.error.code).toBe("INVALID_QUERY");
    expect((await agent.get("/api/dashboard/staff")).status).toBe(403);
  });
  it("includes UTC window start and excludes the millisecond before it", async () => {
    const { agent, user } = await login("anan@example.test");
    const baseline = (await agent.get("/api/dashboard/requester")).body.data;
    const start = new Date(baseline.windowStart);
    const earlier = new Date(start.getTime() - 1);
    const category = await prisma.category.findFirstOrThrow();
    const system = await prisma.relatedSystem.findFirstOrThrow();
    const make = (ticketNumber: string, timestamp: Date) => prisma.ticket.create({ data: { ticketNumber, submittedByUserId: user.id, categoryId: category.id, relatedSystemId: system.id, summary: "Boundary fixture", description: "Dashboard boundary", requestedPriority: "LOW", itPriority: "LOW", currentStatus: "RESOLVED", createdAt: timestamp, updatedAt: timestamp, lastStatusChangedAt: timestamp, lastStatusChangedByUserId: user.id } });
    const inside = await make(`B61I-${Date.now()}`.slice(0, 19), start);
    const outside = await make(`B61O-${Date.now()}`.slice(0, 19), earlier);
    try {
      const response = await agent.get("/api/dashboard/requester"); expect(response.status).toBe(200);
      expect(response.body.data.cards.recentlyUpdated).toBe(baseline.cards.recentlyUpdated + 1);
      expect(response.body.data.cards.recentlyResolved).toBe(baseline.cards.recentlyResolved + 1);
      expect(response.body.data.recentTickets.map((item: { id: string }) => item.id)).not.toContain(outside.id);
      const drilldown = await agent.get("/api/tickets").query({ view: "recent-resolved", from: response.body.data.windowStart, through: response.body.data.asOf, pageSize: 50 });
      expect(drilldown.status).toBe(200);
      expect(drilldown.body.data.map((item: { id: string }) => item.id)).toContain(inside.id);
      expect(drilldown.body.data.map((item: { id: string }) => item.id)).not.toContain(outside.id);
      expect((await agent.get("/api/tickets?view=open&status=NEW")).body.error.code).toBe("INVALID_QUERY");
    } finally { await prisma.ticket.deleteMany({ where: { id: { in: [inside.id, outside.id] } } }); }
  });
});
