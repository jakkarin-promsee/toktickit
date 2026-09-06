import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("GET /api/requesters", () => {
  it("returns only active Development Requesters in display-name order", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.map((item: { displayName: string }) => item.displayName))
      .toEqual(["Anan Chai", "Mali Srisuk", "Niran Boonmee", "Pimchanok Dee"]);

    for (const requester of response.body.data) {
      expect(Object.keys(requester).sort()).toEqual([
        "displayName",
        "email",
        "id",
      ]);
      expect(requester.email).not.toBe("somchai.inactive@example.test");
    }
  });
});
