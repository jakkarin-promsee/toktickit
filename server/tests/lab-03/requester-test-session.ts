import request from "supertest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

export const testOrigin = "http://localhost:5173";
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;

export async function requesterSession(email = "anan@example.test") {
  const user = await getPrisma().user.update({ where: { email }, data: { mustChangePassword: false } });
  await getPrisma().credential.update({ where: { userId: user.id }, data: { passwordHash: await hashPassword(initialPassword) } });
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set("Origin", testOrigin).send({ email, password: initialPassword });
  if (login.status !== 200) throw new Error(`Could not authenticate ${email}.`);
  return { agent, csrfToken: login.body.data.csrfToken as string };
}

export function csrfHeaders(csrfToken: string) {
  return { Origin: testOrigin, "X-CSRF-Token": csrfToken };
}
