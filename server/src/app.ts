import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // lets the Vite dev server on :5173 call this API
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Liveness probe: answers "is this process up and serving HTTP?".
// It deliberately does NOT touch the database — a readiness check would, and
// coupling the two would make the API report itself dead whenever Postgres is
// merely slow. Keeping it DB-free is also what lets the Supertest suite run
// without a running database.
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// The four supported request types, read from PostgreSQL through Prisma.
//
// `orderBy` is not decoration: without an ORDER BY, PostgreSQL is free to
// return rows in any order it finds convenient, and the acceptance criteria
// ask for a predictable one. `select` narrows the row to the two fields the
// labsheet (section 10.2) promises — `createdAt` exists on the model but is
// not part of the published contract, and an endpoint should return what it
// promised rather than whatever the table happens to hold.
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });

    res.status(200).json(categories);
  } catch (error) {
    // 503, not 500: the API itself is fine, its database dependency is not.
    // That distinction tells a caller the request is worth retrying later.
    // The real error goes to the server log; the client gets a sentence that
    // leaks no connection strings or stack traces.
    console.error("GET /api/categories failed:", error);
    res.status(503).json({ error: "Database unavailable" });
  }
});

export default app;
