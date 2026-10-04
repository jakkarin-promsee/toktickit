import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

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
