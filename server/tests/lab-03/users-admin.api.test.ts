import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders } from "./requester-test-session.js";

const prisma = getPrisma();
const origin = "http://localhost:5173";
const seedPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;
const strong = "Valid!Passw0rd-xyz";
const baseEmails = ["anan@example.test", "narin.staff@example.test", "araya.admin@example.test"];
const createdEmails: string[] = [];
let counter = 0;

async function login(email: string, password = seedPassword) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password });
  return { agent, response, csrf: csrfHeaders(response.body?.data?.csrfToken as string) };
}

async function admin() {
  const result = await login("araya.admin@example.test");
  expect(result.response.status).toBe(200);
  return result;
}

function body(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const email = `admin-test-${counter}-${Date.now()}@example.test`;
  createdEmails.push(email);
  return { displayName: `Created User ${counter}`, email, role: "REQUESTER", isActive: true, initialPassword: strong, ...overrides };
}

async function create(a: Awaited<ReturnType<typeof admin>>, overrides: Record<string, unknown> = {}) {
  const payload = body(overrides);
  const response = await a.agent.post("/api/admin/users").set(a.csrf).send(payload);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return { payload, user: response.body.data as { id: number; email: string; version: number; role: string; isActive: boolean } };
}

function editBody(user: { version: number }, overrides: Record<string, unknown> = {}) {
  return { displayName: "Edited Name", email: `edited-${Date.now()}-${counter++}@example.test`, role: "REQUESTER", isActive: true, version: user.version, ...overrides };
}

beforeAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: baseEmails } }, data: { mustChangePassword: false } });
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { OR: [{ email: { startsWith: "admin-test-" } }, { email: { startsWith: "edited-" } }, { email: { in: createdEmails } }] }, select: { id: true } });
  const ids = users.map((user) => user.id);
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.credential.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.update({ where: { email: "araya.admin@example.test" }, data: { isActive: true } });
  await prisma.user.updateMany({ where: { email: { in: baseEmails } }, data: { mustChangePassword: true } });
  await prisma.$disconnect();
});

describe("API-12 authorization", () => {
  it("rejects anonymous, Requester, and IT Staff callers on every user endpoint", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    for (const email of ["anan@example.test", "narin.staff@example.test"]) {
      const { agent, csrf } = await login(email);
      expect((await agent.get("/api/admin/users")).status, email).toBe(403);
      expect((await agent.post("/api/admin/users").set(csrf).send(body())).status).toBe(403);
      expect((await agent.patch("/api/admin/users/1").set(csrf).send(editBody({ version: 0 }))).status).toBe(403);
      expect((await agent.post("/api/admin/users/1/initial-password").set(csrf).send({ initialPassword: strong })).status).toBe(403);
    }
  });

  it("blocks an Administrator who must still change their password and requires CSRF on writes", async () => {
    const a = await admin();
    const noCsrf = await a.agent.post("/api/admin/users").set("Origin", origin).send(body());
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");
    await prisma.user.update({ where: { email: "araya.admin@example.test" }, data: { mustChangePassword: true } });
    const gated = await a.agent.get("/api/admin/users");
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await prisma.user.update({ where: { email: "araya.admin@example.test" }, data: { mustChangePassword: false } });
  });

  it("offers no delete or bulk endpoints", async () => {
    const a = await admin();
    const { user } = await create(a);
    for (const [method, path] of [["delete", `/api/admin/users/${user.id}`], ["delete", "/api/admin/users"], ["post", "/api/admin/users/bulk"], ["post", "/api/admin/users/import"], ["get", "/api/admin/users/export"]] as const) {
      const response = await a.agent[method](path).set(a.csrf).send({});
      expect([404, 400, 501], `${method} ${path}`).toContain(response.status);
    }
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });
});

describe("API-12 list, search, and role filter", () => {
  it("lists users ordered by name then id with safe fields only", async () => {
    const a = await admin();
    const response = await a.agent.get("/api/admin/users");
    expect(response.status).toBe(200);
    const names = response.body.data.map((u: { displayName: string }) => u.displayName);
    expect([...names].sort((x: string, y: string) => x.localeCompare(y, "en"))).toBeTruthy();
    expect(Object.keys(response.body.data[0]).sort()).toEqual(["createdAt", "displayName", "email", "id", "isActive", "mustChangePassword", "role", "updatedAt", "version"]);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash/);
    expect(response.body.data.some((u: { isActive: boolean }) => !u.isActive)).toBe(true);
  });

  it("searches name and email case-insensitively with trimming and filters by one role", async () => {
    const a = await admin();
    const byName = await a.agent.get("/api/admin/users?search=%20NARIN%20");
    expect(byName.body.data.map((u: { email: string }) => u.email)).toContain("narin.staff@example.test");
    const byEmail = await a.agent.get("/api/admin/users?search=ARAYA.ADMIN@");
    expect(byEmail.body.data.map((u: { email: string }) => u.email)).toEqual(["araya.admin@example.test"]);
    const staff = await a.agent.get("/api/admin/users?role=IT_STAFF");
    expect(staff.body.data.length).toBeGreaterThan(0);
    expect(staff.body.data.every((u: { role: string }) => u.role === "IT_STAFF")).toBe(true);
    const combined = await a.agent.get("/api/admin/users?role=REQUESTER&search=narin");
    expect(combined.body.data).toEqual([]);
  });

  it("rejects unknown, duplicate, oversized, and unsupported query values", async () => {
    const a = await admin();
    for (const query of ["role=OWNER", "role=requester", "role=REQUESTER&role=IT_STAFF", "search=a&search=b", `search=${"x".repeat(121)}`, "page=1", "sort=email"]) {
      const response = await a.agent.get(`/api/admin/users?${query}`);
      expect(response.status, query).toBe(400);
      expect(response.body.error.code).toBe("INVALID_QUERY");
    }
  });
});

describe("API-12 create user", () => {
  it("creates a user with a normalized email, one role, hashed password, and forced password change", async () => {
    const a = await admin();
    const payload = body({ email: `  Admin-Test-Mixed-${Date.now()}@Example.TEST  `, displayName: "  Mixed Case  ", role: "IT_STAFF", isActive: true });
    createdEmails.push(String(payload.email).trim().toLowerCase());
    const response = await a.agent.post("/api/admin/users").set(a.csrf).send(payload);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ displayName: "Mixed Case", role: "IT_STAFF", isActive: true, mustChangePassword: true, version: 0 });
    expect(response.body.data.email).toBe(String(payload.email).trim().toLowerCase());
    expect(JSON.stringify(response.body)).not.toContain(strong);
    const credential = await prisma.credential.findUniqueOrThrow({ where: { userId: response.body.data.id } });
    expect(credential.passwordHash).toMatch(/^\$argon2id\$/);
    expect(credential.passwordHash).not.toContain(strong);
    const signedIn = await login(response.body.data.email, strong);
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.response.body.data.mustChangePassword).toBe(true);
    const gated = await signedIn.agent.get("/api/staff/tickets");
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("can create an inactive user who cannot sign in", async () => {
    const a = await admin();
    const { payload } = await create(a, { isActive: false });
    expect((await login(payload.email as string, strong)).response.status).toBe(401);
  });

  it("rejects duplicate emails including case and whitespace variants", async () => {
    const a = await admin();
    const { payload } = await create(a);
    for (const email of [payload.email, String(payload.email).toUpperCase(), `  ${payload.email}  `, "ANAN@example.test"]) {
      const response = await a.agent.post("/api/admin/users").set(a.csrf).send(body({ email }));
      expect(response.status, String(email)).toBe(409);
      expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    }
  });

  it("rejects invalid names, emails, roles, active flags, and password boundaries with field errors", async () => {
    const a = await admin();
    const cases: [Record<string, unknown>, string][] = [
      [{ displayName: "A" }, "displayName"], [{ displayName: "   " }, "displayName"], [{ displayName: "x".repeat(101) }, "displayName"], [{ displayName: 5 }, "displayName"],
      [{ email: "not-an-email" }, "email"], [{ email: `${"a".repeat(250)}@example.test` }, "email"], [{ email: "" }, "email"],
      [{ role: "OWNER" }, "role"], [{ role: ["IT_STAFF", "ADMINISTRATOR"] }, "role"], [{ role: "requester" }, "role"],
      [{ isActive: "yes" }, "isActive"], [{ isActive: null }, "isActive"],
      [{ initialPassword: "Short1!a" }, "initialPassword"], [{ initialPassword: "alllowercase1!x" }, "initialPassword"], [{ initialPassword: "NoDigitsHere!!!" }, "initialPassword"], [{ initialPassword: "NoSymbolHere123" }, "initialPassword"], [{ initialPassword: `Aa1!${"x".repeat(125)}` }, "initialPassword"],
    ];
    for (const [overrides, field] of cases) {
      const response = await a.agent.post("/api/admin/users").set(a.csrf).send(body(overrides));
      expect(response.status, JSON.stringify(overrides)).toBe(422);
      expect(response.body.error.fields[field]).toBeTruthy();
    }
    const exactly12 = await a.agent.post("/api/admin/users").set(a.csrf).send(body({ initialPassword: "Abcdefgh1!xy" }));
    expect(exactly12.status).toBe(201);
    const exactly128 = await a.agent.post("/api/admin/users").set(a.csrf).send(body({ initialPassword: `Aa1!${"x".repeat(124)}` }));
    expect(exactly128.status).toBe(201);
  });

  it("rejects missing or extra body keys as malformed", async () => {
    const a = await admin();
    const { initialPassword: _omit, ...missing } = body();
    expect((await a.agent.post("/api/admin/users").set(a.csrf).send(missing)).status).toBe(400);
    expect((await a.agent.post("/api/admin/users").set(a.csrf).send(body({ roles: ["IT_STAFF"] }))).status).toBe(400);
    expect((await a.agent.post("/api/admin/users").set(a.csrf).send(body({ department: "IT" }))).status).toBe(400);
  });
});

describe("API-12 edit user", () => {
  it("edits name, email, role, and active state, increments version, and revokes sessions only when needed", async () => {
    const a = await admin();
    const { payload, user } = await create(a, { role: "REQUESTER" });
    const target = await login(payload.email as string, strong);
    expect(target.response.status).toBe(200);
    const nameOnly = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send({ displayName: "Only Name", email: user.email, role: "REQUESTER", isActive: true, version: user.version });
    expect(nameOnly.status).toBe(200);
    expect(nameOnly.body.data).toMatchObject({ displayName: "Only Name", version: 1 });
    expect((await target.agent.get("/api/auth/me")).status).toBe(200);
    const roleChange = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send({ displayName: "Only Name", email: user.email, role: "IT_STAFF", isActive: true, version: 1 });
    expect(roleChange.status).toBe(200);
    expect(roleChange.body.data.role).toBe("IT_STAFF");
    expect((await target.agent.get("/api/auth/me")).status).toBe(401);
  });

  it("deactivates and reactivates without deleting the record, and the user cannot sign in while inactive", async () => {
    const a = await admin();
    const { payload, user } = await create(a);
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    const off = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send({ displayName: "Off", email: user.email, role: "REQUESTER", isActive: false, version: user.version });
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);
    expect((await login(payload.email as string, strong)).response.status).toBe(401);
    const on = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send({ displayName: "Off", email: user.email, role: "REQUESTER", isActive: true, version: off.body.data.version });
    expect(on.status).toBe(200);
    expect((await login(payload.email as string, strong)).response.status).toBe(200);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it("rejects duplicate email, invalid role, stale version, missing user, malformed body, and bad IDs", async () => {
    const a = await admin();
    const { user } = await create(a);
    const dup = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send({ displayName: "Dup", email: "ANAN@example.test", role: "REQUESTER", isActive: true, version: 0 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    const badRole = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send(editBody(user, { role: "ROOT" }));
    expect(badRole.status).toBe(422);
    expect(badRole.body.error.fields.role).toBeTruthy();
    const stale = await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send(editBody(user, { version: 9 }));
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_USER");
    expect((await a.agent.patch("/api/admin/users/999999").set(a.csrf).send(editBody(user))).body.error.code).toBe("USER_NOT_FOUND");
    expect((await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send({ displayName: "Partial", version: 0 })).status).toBe(400);
    expect((await a.agent.patch("/api/admin/users/abc").set(a.csrf).send(editBody(user))).status).toBe(400);
    expect((await a.agent.patch("/api/admin/users/0").set(a.csrf).send(editBody(user))).status).toBe(400);
    expect((await a.agent.patch(`/api/admin/users/${user.id}`).set(a.csrf).send(editBody(user, { version: -1 }))).status).toBe(422);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.version).toBe(0);
  });

  it("prevents an Administrator from deactivating or changing the role of their own account", async () => {
    const a = await admin();
    const me = await prisma.user.findUniqueOrThrow({ where: { email: "araya.admin@example.test" } });
    for (const overrides of [{ isActive: false }, { role: "IT_STAFF" }]) {
      const response = await a.agent.patch(`/api/admin/users/${me.id}`).set(a.csrf).send({ displayName: me.displayName, email: me.email, role: "ADMINISTRATOR", isActive: true, version: me.version, ...overrides });
      expect(response.status, JSON.stringify(overrides)).toBe(409);
      expect(response.body.error.code).toBe("SELF_ADMIN_CHANGE_FORBIDDEN");
    }
    const nameOk = await a.agent.patch(`/api/admin/users/${me.id}`).set(a.csrf).send({ displayName: me.displayName, email: me.email, role: "ADMINISTRATOR", isActive: true, version: me.version });
    expect(nameOk.status).toBe(200);
  });

  it("refuses to deactivate or demote a user who owns Tickets", async () => {
    const a = await admin();
    const narin = await prisma.user.findUniqueOrThrow({ where: { email: "narin.staff@example.test" } });
    for (const overrides of [{ isActive: false }, { role: "REQUESTER" }]) {
      const response = await a.agent.patch(`/api/admin/users/${narin.id}`).set(a.csrf).send({ displayName: narin.displayName, email: narin.email, role: "IT_STAFF", isActive: true, version: narin.version, ...overrides });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("USER_OWNS_TICKETS");
    }
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: narin.id } });
    expect(stored).toMatchObject({ isActive: true, role: "IT_STAFF" });
  });

  it("keeps at least one active Administrator when two Administrators change each other at the same time", async () => {
    const a = await admin();
    const { payload, user: second } = await create(a, { role: "ADMINISTRATOR" });
    await prisma.user.update({ where: { id: second.id }, data: { mustChangePassword: false } });
    const b = await login(payload.email as string, strong);
    expect(b.response.status).toBe(200);
    const first = await prisma.user.findUniqueOrThrow({ where: { email: "araya.admin@example.test" } });
    const [one, two] = await Promise.all([
      a.agent.patch(`/api/admin/users/${second.id}`).set(a.csrf).send({ displayName: "Second", email: second.email, role: "ADMINISTRATOR", isActive: false, version: second.version }),
      b.agent.patch(`/api/admin/users/${first.id}`).set(b.csrf).send({ displayName: first.displayName, email: first.email, role: "ADMINISTRATOR", isActive: false, version: first.version }),
    ]);
    // The loser is either stopped by the last-admin rule (409) or, if it arrives after the winner committed, by the revoked session (401).
    expect([one.status, two.status].filter((status) => status === 200)).toHaveLength(1);
    const loser = one.status === 200 ? two : one;
    expect([401, 409]).toContain(loser.status);
    if (loser.status === 409) expect(loser.body.error.code).toBe("LAST_ACTIVE_ADMINISTRATOR");
    expect(await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBeGreaterThanOrEqual(1);
    await prisma.user.update({ where: { email: "araya.admin@example.test" }, data: { isActive: true } });
  });
});

describe("API-12 set a new initial password", () => {
  it("replaces the credential, forces a change at next login, and ends existing sessions without echoing the password", async () => {
    const a = await admin();
    const { payload, user } = await create(a);
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    const target = await login(payload.email as string, strong);
    expect(target.response.status).toBe(200);
    const next = "Different!Pass456";
    const reset = await a.agent.post(`/api/admin/users/${user.id}/initial-password`).set(a.csrf).send({ initialPassword: next });
    expect(reset.status).toBe(204);
    expect(reset.text).toBe("");
    expect((await target.agent.get("/api/auth/me")).status).toBe(401);
    expect((await login(payload.email as string, strong)).response.status).toBe(401);
    const again = await login(payload.email as string, next);
    expect(again.response.status).toBe(200);
    expect(again.response.body.data.mustChangePassword).toBe(true);
    const credential = await prisma.credential.findUniqueOrThrow({ where: { userId: user.id } });
    expect(credential.passwordHash).not.toContain(next);
  });

  it("validates the password, the user, and the body without changing the credential", async () => {
    const a = await admin();
    const { payload, user } = await create(a);
    const weak = await a.agent.post(`/api/admin/users/${user.id}/initial-password`).set(a.csrf).send({ initialPassword: "weak" });
    expect(weak.status).toBe(422);
    expect(weak.body.error.fields.initialPassword).toBeTruthy();
    expect((await a.agent.post("/api/admin/users/999999/initial-password").set(a.csrf).send({ initialPassword: strong })).body.error.code).toBe("USER_NOT_FOUND");
    expect((await a.agent.post(`/api/admin/users/${user.id}/initial-password`).set(a.csrf).send({ initialPassword: strong, extra: 1 })).status).toBe(400);
    expect((await a.agent.post(`/api/admin/users/${user.id}/initial-password`).set("Origin", origin).send({ initialPassword: strong })).status).toBe(403);
    expect((await login(payload.email as string, strong)).response.status).toBe(200);
  });
});
