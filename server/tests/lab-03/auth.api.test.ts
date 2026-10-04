import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";

const origin = "http://localhost:5173";
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("API-01/API-02 authentication", () => {
  it("uses one safe failure for unknown, wrong, and inactive credentials", async () => {
    const attempts = [
      { email: "missing@example.test", password: initialPassword },
      { email: "anan@example.test", password: "Wrong!Pass123" },
      { email: "somchai.inactive@example.test", password: initialPassword },
    ];
    const responses = await Promise.all(attempts.map((body) => request(app).post("/api/auth/login").set("Origin", origin).send(body)));
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: { code: "AUTHENTICATION_FAILED", message: "Sign-in failed. Check your credentials or account status." } });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("creates a limited session, requires CSRF to change the initial password, rotates it, and logs out", async () => {
    await getPrisma().user.update({ where: { email: "anan@example.test" }, data: { mustChangePassword: true } });
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").set("Origin", origin).send({ email: "  anan@example.test ", password: initialPassword });
    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({ email: "anan@example.test", mustChangePassword: true });
    expect(login.body.data.passwordHash).toBeUndefined();
    expect(String(login.headers["set-cookie"])).toContain("HttpOnly");

    expect((await agent.get("/api/app")).status).toBe(403);
    expect((await agent.post("/api/auth/change-password").set("Origin", origin).send({ currentPassword: initialPassword, newPassword: "Changed!Pass123" })).status).toBe(403);

    const changed = await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", login.body.data.csrfToken).send({ currentPassword: initialPassword, newPassword: "Changed!Pass123" });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ mustChangePassword: false });
    expect(changed.body.data.csrfToken).not.toBe(login.body.data.csrfToken);

    expect((await agent.get("/api/auth/me")).status).toBe(200);
    const logout = await agent.post("/api/auth/logout").set("Origin", origin).set("X-CSRF-Token", changed.body.data.csrfToken);
    expect(logout.status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });
});

const tempPassword = "Temp!Passw0rd-38";
let tempCounter = 0;

async function tempUser(overrides: { isActive?: boolean; mustChangePassword?: boolean } = {}) {
  tempCounter += 1;
  const email = `issue38-auth-${tempCounter}-${Date.now()}@example.test`;
  return getPrisma().user.create({ data: { displayName: `Issue 38 Auth ${tempCounter}`, email, role: "REQUESTER", isActive: overrides.isActive ?? true, mustChangePassword: overrides.mustChangePassword ?? false, credential: { create: { passwordHash: await hashPassword(tempPassword) } } } });
}

async function signIn(email: string, password = tempPassword) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password });
  return { agent, response, csrf: response.body?.data?.csrfToken as string };
}

afterAll(async () => {
  const users = await getPrisma().user.findMany({ where: { email: { startsWith: "issue38-auth-" } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  await getPrisma().session.deleteMany({ where: { userId: { in: ids } } });
  await getPrisma().credential.deleteMany({ where: { userId: { in: ids } } });
  await getPrisma().user.deleteMany({ where: { id: { in: ids } } });
});

describe("API-01 Issue #38 login boundaries", () => {
  it("returns safe user data and a hardened cookie for a valid active login without exposing credentials", async () => {
    const user = await tempUser();
    const { response } = await signIn(`  ${user.email.toUpperCase()} `);
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data).sort()).toEqual(["csrfToken", "displayName", "email", "id", "isActive", "mustChangePassword", "role", "sessionExpiresAt"]);
    const cookie = String(response.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(JSON.stringify(response.body)).not.toContain(tempPassword);
    expect(JSON.stringify(response.body)).not.toContain("argon2");
  });

  it("rejects malformed bodies with 400 and a disallowed Origin with 403 without creating a session", async () => {
    for (const body of [{}, { email: "a@example.test" }, { password: tempPassword }, { email: 1, password: tempPassword }, { email: "a@example.test", password: "x".repeat(129) }]) {
      const response = await request(app).post("/api/auth/login").set("Origin", origin).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MALFORMED_REQUEST");
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
    const badOrigin = await request(app).post("/api/auth/login").set("Origin", "http://evil.example").send({ email: "anan@example.test", password: initialPassword });
    expect(badOrigin.status).toBe(403);
    expect(badOrigin.body.error.code).toBe("CSRF_INVALID");
    expect(badOrigin.headers["set-cookie"]).toBeUndefined();
  });

  it("throttles after five failures with Retry-After and blocks even the correct password until the window ends", async () => {
    const user = await tempUser();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await signIn(user.email, "Wrong!Passw0rd-38")).response.status).toBe(401);
    }
    const throttled = await signIn(user.email);
    expect(throttled.response.status).toBe(429);
    expect(throttled.response.body.error.code).toBe("TOO_MANY_ATTEMPTS");
    expect(Number(throttled.response.headers["retry-after"])).toBeGreaterThan(0);
    expect(throttled.response.headers["set-cookie"]).toBeUndefined();
  });

  it("resets the failure counter after a successful login", async () => {
    const user = await tempUser();
    for (let attempt = 0; attempt < 4; attempt += 1) await signIn(user.email, "Wrong!Passw0rd-38");
    expect((await signIn(user.email)).response.status).toBe(200);
    for (let attempt = 0; attempt < 4; attempt += 1) await signIn(user.email, "Wrong!Passw0rd-38");
    expect((await signIn(user.email)).response.status).toBe(200);
  });

  it("ends an existing session when the account is deactivated", async () => {
    const user = await tempUser();
    const { agent } = await signIn(user.email);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
    await getPrisma().user.update({ where: { id: user.id }, data: { isActive: false } });
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("API-02 Issue #38 password change boundaries", () => {
  it("accepts 12 and 128 characters and rejects 11 and 129 characters", async () => {
    const twelve = "Abcdefgh1!xy";
    const oneTwentyEight = `Aa1!${"x".repeat(124)}`;
    expect(Array.from(twelve)).toHaveLength(12);
    expect(Array.from(oneTwentyEight)).toHaveLength(128);

    const user = await tempUser({ mustChangePassword: true });
    const { agent, csrf } = await signIn(user.email);
    const tooShort = await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send({ currentPassword: tempPassword, newPassword: "Abcdefg1!xy" });
    expect(tooShort.status).toBe(422);
    expect(tooShort.body.error.fields.newPassword).toMatch(/12/);
    const tooLong = await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send({ currentPassword: tempPassword, newPassword: `${oneTwentyEight}y` });
    expect(tooLong.status).toBe(400);
    const okTwelve = await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send({ currentPassword: tempPassword, newPassword: twelve });
    expect(okTwelve.status).toBe(200);
    const okMax = await agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", okTwelve.body.data.csrfToken).send({ currentPassword: twelve, newPassword: oneTwentyEight });
    expect(okMax.status).toBe(200);
  });

  it("rejects a wrong current password, a reused password, and missing composition without changing the credential", async () => {
    const user = await tempUser({ mustChangePassword: true });
    const before = await getPrisma().credential.findUniqueOrThrow({ where: { userId: user.id } });
    const { agent, csrf } = await signIn(user.email);
    const send = (body: Record<string, unknown>) => agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", csrf).send(body);
    const wrong = await send({ currentPassword: "Wrong!Passw0rd-38", newPassword: "Another!Passw0rd" });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.fields.currentPassword).toBe("Current password is incorrect.");
    const same = await send({ currentPassword: tempPassword, newPassword: tempPassword });
    expect(same.status).toBe(422);
    expect(same.body.error.fields.newPassword).toMatch(/differ/);
    const weak = await send({ currentPassword: tempPassword, newPassword: "nouppercase1!xyz" });
    expect(weak.status).toBe(422);
    expect((await send({ currentPassword: tempPassword })).status).toBe(400);
    const after = await getPrisma().credential.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect((await getPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(true);
  });

  it("revokes every prior session on success so only the rotated session works", async () => {
    const user = await tempUser({ mustChangePassword: true });
    const first = await signIn(user.email);
    const second = await signIn(user.email);
    const changed = await first.agent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", first.csrf).send({ currentPassword: tempPassword, newPassword: "Rotated!Passw0rd" });
    expect(changed.status).toBe(200);
    expect((await first.agent.get("/api/app")).status).toBe(200);
    expect((await second.agent.get("/api/auth/me")).status).toBe(401);
    expect((await signIn(user.email)).response.status).toBe(401);
    expect((await signIn(user.email, "Rotated!Passw0rd")).response.status).toBe(200);
  });
});

describe("API-02 Issue #38 logout", () => {
  it("is idempotent without a session and requires CSRF when a session exists", async () => {
    const anonymous = await request(app).post("/api/auth/logout").set("Origin", origin);
    expect(anonymous.status).toBe(204);
    const user = await tempUser();
    const { agent, csrf } = await signIn(user.email);
    expect((await agent.post("/api/auth/logout").set("Origin", origin)).status).toBe(403);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
    expect((await agent.post("/api/auth/logout").set("Origin", origin).set("X-CSRF-Token", csrf)).status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect((await agent.get("/api/tickets")).status).toBe(401);
    expect((await agent.post("/api/auth/logout").set("Origin", origin)).status).toBe(204);
  });
});
