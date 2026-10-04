import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { parseStaffQuery } from "../../src/staff-query.js";

const prisma = getPrisma();
const origin = "http://localhost:5173";
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;
const emails = ["anan@example.test", "narin.staff@example.test", "kanda.staff@example.test", "araya.admin@example.test"];

async function signedIn(email: string) {
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password: initialPassword });
  expect(login.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: emails } }, data: { mustChangePassword: false } });
});

afterAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: emails } }, data: { mustChangePassword: true } });
  await prisma.$disconnect();
});

describe("UNIT-03 staff query parsing", () => {
  it("applies documented defaults", () => {
    expect(parseStaffQuery({})).toMatchObject({ search: "", sortBy: "updatedAt", sortOrder: "desc", page: 1, pageSize: 20 });
  });

  it("trims search and rejects unknown, duplicate, malformed, and unsupported values", () => {
    expect(parseStaffQuery({ search: "  vpn  " }).search).toBe("vpn");
    for (const bad of [{ foo: "1" }, { search: ["a", "b"] }, { search: "x".repeat(121) }, { categoryId: "0" }, { categoryId: "1.5" }, { status: "DONE" }, { requestedPriority: "URGENT" }, { itPriority: "low" }, { owner: "0" }, { owner: "someone" }, { sortBy: "summary" }, { sortBy: "password" }, { sortOrder: "up" }, { page: "0" }, { page: "-1" }, { pageSize: "15" }, { pageSize: "abc" }, { pageSize: "10.0" }]) {
      expect(() => parseStaffQuery(bad), JSON.stringify(bad)).toThrow();
    }
  });

  it("accepts every allow-listed value", () => {
    for (const sortBy of ["updatedAt", "createdAt", "ticketNumber", "requestedPriority", "itPriority", "status"]) expect(parseStaffQuery({ sortBy }).sortBy).toBe(sortBy);
    expect(parseStaffQuery({ owner: "me" }).owner).toBe("me");
    expect(parseStaffQuery({ owner: "unassigned" }).owner).toBe("unassigned");
    expect(parseStaffQuery({ owner: "7" }).owner).toBe(7);
    for (const pageSize of ["10", "20", "50"]) expect(parseStaffQuery({ pageSize }).pageSize).toBe(Number(pageSize));
  });
});

describe("API-07 staff ticket queue authorization", () => {
  it("requires authentication and rejects Requesters", async () => {
    expect((await request(app).get("/api/staff/tickets")).status).toBe(401);
    const requester = await signedIn("anan@example.test");
    const response = await requester.get("/api/staff/tickets");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(response.body).not.toHaveProperty("data");
  });

  it("allows IT Staff and read-only Administrators", async () => {
    for (const email of ["narin.staff@example.test", "araya.admin@example.test"]) {
      const agent = await signedIn(email);
      const response = await agent.get("/api/staff/tickets");
      expect(response.status).toBe(200);
    }
  });

  it("does not let a password-change-required Staff session in", async () => {
    await prisma.user.update({ where: { email: "kanda.staff@example.test" }, data: { mustChangePassword: true } });
    const agent = await signedIn("kanda.staff@example.test");
    const response = await agent.get("/api/staff/tickets");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await prisma.user.update({ where: { email: "kanda.staff@example.test" }, data: { mustChangePassword: false } });
  });
});

describe("API-07 staff ticket queue results", () => {
  it("returns shared tickets from every requester with owner, priorities, status, pagination, and counts", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const response = await agent.get("/api/staff/tickets");
    expect(response.status).toBe(200);
    const total = await prisma.ticket.count();
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: total, totalPages: Math.ceil(total / 20), hasPreviousPage: false, hasNextPage: total > 20 });
    expect(response.body.counts).toEqual({ total, unassigned: await prisma.ticket.count({ where: { ownerId: null } }), mine: await prisma.ticket.count({ where: { owner: { email: "narin.staff@example.test" } } }) });
    const requesters = new Set(response.body.data.map((ticket: { requester: { id: number } }) => ticket.requester.id));
    expect(requesters.size).toBeGreaterThan(1);
    const row = response.body.data[0];
    expect(Object.keys(row).sort()).toEqual(["category", "createdAt", "currentStatus", "id", "itPriority", "owner", "relatedSystem", "requestedPriority", "requester", "requesterResolvedAt", "summary", "ticketNumber", "updatedAt", "version"]);
    const owners = response.body.data.map((ticket: { owner: unknown }) => ticket.owner);
    expect(owners.some((owner: unknown) => owner === null)).toBe(true);
    expect(owners.some((owner: unknown) => owner !== null)).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/"email"|passwordHash|"description"/);
  });

  it("defaults to updatedAt desc with an id tie-breaker and reverses cleanly", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const desc = await agent.get("/api/staff/tickets?pageSize=50");
    const asc = await agent.get("/api/staff/tickets?pageSize=50&sortOrder=asc");
    const stamps = desc.body.data.map((ticket: { updatedAt: string }) => Date.parse(ticket.updatedAt));
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
    expect(asc.body.data.map((t: { id: string }) => t.id)).toEqual([...desc.body.data.map((t: { id: string }) => t.id)].reverse());
  });

  it("sorts by each allow-listed field in both directions", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const numbers = (await agent.get("/api/staff/tickets?sortBy=ticketNumber&sortOrder=asc&pageSize=50")).body.data.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect([...numbers].sort()).toEqual(numbers);
    const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
    const priorities = (await agent.get("/api/staff/tickets?sortBy=itPriority&sortOrder=desc&pageSize=50")).body.data.map((t: { itPriority: keyof typeof rank }) => rank[t.itPriority]);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
    for (const sortBy of ["createdAt", "requestedPriority", "status"]) {
      for (const sortOrder of ["asc", "desc"]) expect((await agent.get(`/api/staff/tickets?sortBy=${sortBy}&sortOrder=${sortOrder}`)).status).toBe(200);
    }
  });

  it("searches ticket number, summary, requester name, and requester email case-insensitively with trimming", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const byNumber = await agent.get("/api/staff/tickets?search=%20tkt-20261004-310003%20");
    expect(byNumber.body.data.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual(["TKT-20261004-310003"]);
    const bySummary = await agent.get("/api/staff/tickets?search=LAPTOP%20BATTERY");
    expect(bySummary.body.data.length).toBeGreaterThan(0);
    const byName = await agent.get("/api/staff/tickets?search=niran%20boonmee");
    expect(byName.body.data.length).toBeGreaterThan(0);
    expect(byName.body.data.every((t: { requester: { displayName: string } }) => t.requester.displayName === "Niran Boonmee")).toBe(true);
    const byEmail = await agent.get("/api/staff/tickets?search=PIM@EXAMPLE");
    expect(byEmail.body.data.length).toBeGreaterThan(0);
    expect(byEmail.body.data.every((t: { requester: { displayName: string } }) => t.requester.displayName === "Pimchanok Dee")).toBe(true);
    const none = await agent.get("/api/staff/tickets?search=zzzz-no-match");
    expect(none.status).toBe(200);
    expect(none.body.data).toEqual([]);
    expect(none.body.pagination.totalPages).toBe(0);
    expect(none.body.counts.total).toBeGreaterThan(0);
  });

  it("filters by status, priorities, category, related system, and combines filters with AND", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const waiting = await agent.get("/api/staff/tickets?status=WAITING_FOR_REQUESTER&pageSize=50");
    expect(waiting.body.data.length).toBeGreaterThan(0);
    expect(waiting.body.data.every((t: { currentStatus: string }) => t.currentStatus === "WAITING_FOR_REQUESTER")).toBe(true);
    const high = await agent.get("/api/staff/tickets?requestedPriority=HIGH&itPriority=MEDIUM&pageSize=50");
    expect(high.body.data.every((t: { requestedPriority: string; itPriority: string }) => t.requestedPriority === "HIGH" && t.itPriority === "MEDIUM")).toBe(true);
    const network = await prisma.category.findFirstOrThrow({ where: { name: "Network" } });
    const vpn = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "VPN" } });
    const both = await agent.get(`/api/staff/tickets?categoryId=${network.id}&relatedSystemId=${vpn.id}&pageSize=50`);
    expect(both.body.data.every((t: { category: { id: number }; relatedSystem: { id: number } }) => t.category.id === network.id && t.relatedSystem.id === vpn.id)).toBe(true);
    const combined = await agent.get(`/api/staff/tickets?categoryId=${network.id}&status=WAITING_FOR_REQUESTER`);
    expect(combined.body.data.every((t: { currentStatus: string }) => t.currentStatus === "WAITING_FOR_REQUESTER")).toBe(true);
  });

  it("filters owner by me, unassigned, and a specific eligible user", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const narin = await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } });
    const mine = await agent.get("/api/staff/tickets?owner=me&pageSize=50");
    expect(mine.body.data.length).toBeGreaterThan(0);
    expect(mine.body.data.every((t: { owner: { id: number } | null }) => t.owner?.id === narin.id)).toBe(true);
    expect(mine.body.pagination.totalItems).toBe(mine.body.counts.mine);
    const unassigned = await agent.get("/api/staff/tickets?owner=unassigned&pageSize=50");
    expect(unassigned.body.data.length).toBeGreaterThan(0);
    expect(unassigned.body.data.every((t: { owner: unknown }) => t.owner === null)).toBe(true);
    expect(unassigned.body.pagination.totalItems).toBe(unassigned.body.counts.unassigned);
    const kanda = await prisma.user.findUniqueOrThrow({ where: { email: "kanda.staff@example.test" } });
    const byId = await agent.get(`/api/staff/tickets?owner=${kanda.id}&pageSize=50`);
    expect(byId.body.data.every((t: { owner: { id: number } | null }) => t.owner?.id === kanda.id)).toBe(true);
    const admin = await signedIn("araya.admin@example.test");
    expect((await admin.get("/api/staff/tickets?owner=me")).status).toBe(200);
  });

  it("paginates with accurate metadata, allowed sizes, and valid empty beyond-end pages", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const total = await prisma.ticket.count();
    const first = await agent.get("/api/staff/tickets?pageSize=10&page=1");
    expect(first.body.data).toHaveLength(Math.min(10, total));
    expect(first.body.pagination).toMatchObject({ page: 1, pageSize: 10, totalItems: total, hasPreviousPage: false, hasNextPage: total > 10 });
    const second = await agent.get("/api/staff/tickets?pageSize=10&page=2");
    expect(second.body.pagination.hasPreviousPage).toBe(true);
    const firstIds = new Set(first.body.data.map((t: { id: string }) => t.id));
    expect(second.body.data.some((t: { id: string }) => firstIds.has(t.id))).toBe(false);
    const beyond = await agent.get("/api/staff/tickets?pageSize=10&page=999");
    expect(beyond.status).toBe(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.pagination.totalItems).toBe(total);
  });

  it("returns 400 INVALID_QUERY for invalid, duplicate, unknown, and inactive-reference parameters", async () => {
    const agent = await signedIn("narin.staff@example.test");
    const inactiveUser = await prisma.user.findUniqueOrThrow({ where: { email: "wichai.inactive.staff@example.test" } });
    const requesterUser = await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } });
    for (const query of ["page=0", "pageSize=15", "sortBy=summary", "sortOrder=sideways", "status=DONE", "itPriority=URGENT", "owner=nobody", "foo=1", "status=NEW&status=OPEN", "categoryId=999999", "relatedSystemId=999999", `owner=${inactiveUser.id}`, `owner=${requesterUser.id}`, `search=${"x".repeat(121)}`]) {
      const response = await agent.get(`/api/staff/tickets?${query}`);
      expect(response.status, query).toBe(400);
      expect(response.body.error.code).toBe("INVALID_QUERY");
    }
  });
});
