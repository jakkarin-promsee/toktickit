import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";

const prisma = getPrisma();
async function login(email: string) { const user = await prisma.user.update({ where: { email }, data: { mustChangePassword: false } }); await prisma.credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(process.env.LAB3_SEED_INITIAL_PASSWORD!) } }); const agent = request.agent(app); const response = await agent.post("/api/auth/login").set("Origin", "http://localhost:5173").send({ email, password: process.env.LAB3_SEED_INITIAL_PASSWORD }); expect(response.status).toBe(200); return agent; }
afterAll(async () => { await prisma.user.updateMany({ where: { email: { in: ["anan@example.test", "narin.staff@example.test"] } }, data: { mustChangePassword: true } }); await prisma.$disconnect(); });

describe("Dashboard drill-down filters", () => {
  it("preserves each Requester card's query and fixed UTC window", async () => {
    const agent = await login("anan@example.test");
    const dashboard = (await agent.get("/api/dashboard/requester")).body.data;
    for (const [view, card] of [["open", "openTickets"], ["attention", "waitingForYou"], ["recent-updated", "recentlyUpdated"], ["recent-resolved", "recentlyResolved"]] as const) {
      const response = await agent.get("/api/tickets").query({ view, ...(view.startsWith("recent-") ? { from: dashboard.windowStart, through: dashboard.asOf } : {}) });
      expect(response.status).toBe(200);
      expect(response.body.pagination.totalItems).toBe(dashboard.cards[card]);
    }
    for (const query of ["view=open&status=NEW", "view=recent-updated", "view=recent-updated&from=bad&through=2026-10-31T10%3A00%3A00.000Z", "view=attention&from=2026-10-25T00%3A00%3A00.000Z", "view=open&view=attention"]) expect((await agent.get(`/api/tickets?${query}`)).body.error.code).toBe("INVALID_QUERY");
  });
  it("preserves Staff operational counts, distinct Action Tickets and rejects conflicting filters", async () => {
    const agent = await login("narin.staff@example.test");
    const dashboard = (await agent.get("/api/dashboard/staff")).body.data;
    for (const [view, card] of [["unassigned", "unassignedTickets"], ["owned-by-me", "myTickets"]] as const) {
      const response = await agent.get("/api/staff/tickets").query({ view });
      expect(response.status).toBe(200);
      expect(response.body.pagination.totalItems).toBe(dashboard.cards[card]);
    }
    for (const status of Object.keys(dashboard.byStatus)) expect((await agent.get("/api/staff/tickets").query({ status })).body.pagination.totalItems).toBe(dashboard.byStatus[status]);
    for (const itPriority of Object.keys(dashboard.byItPriority)) expect((await agent.get("/api/staff/tickets").query({ itPriority })).body.pagination.totalItems).toBe(dashboard.byItPriority[itPriority]);
    const actionView = await agent.get("/api/staff/tickets?view=my-active-actions");
    expect(actionView.status).toBe(200);
    expect(actionView.body.data.every((item: { matchingActionCount: number }) => Number.isInteger(item.matchingActionCount) && item.matchingActionCount > 0)).toBe(true);
    expect(actionView.body.pagination.totalItems).toBeLessThanOrEqual(dashboard.cards.myActiveActions);
    const recentView = await agent.get("/api/staff/tickets").query({ view: "recent-updated", from: dashboard.windowStart, through: dashboard.asOf });
    expect(recentView.status).toBe(200);
    expect(recentView.body.data.every((item: { updatedAt: string }) => item.updatedAt >= dashboard.windowStart && item.updatedAt <= dashboard.asOf)).toBe(true);
    for (const query of ["view=urgent&status=OPEN", "view=urgent&owner=me", "view=urgent&requestedPriority=HIGH", "view=urgent&itPriority=HIGH", "view=recent-updated", "view=urgent&from=2026-10-25T00%3A00%3A00.000Z", "view=urgent&view=unassigned"]) expect((await agent.get(`/api/staff/tickets?${query}`)).body.error.code).toBe("INVALID_QUERY");
  });
});
