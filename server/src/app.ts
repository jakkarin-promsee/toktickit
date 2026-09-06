import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import {
  findAvailableTicketNumber,
  formatTicketNumber,
} from "./ticket-number.js";
import {
  CreateTicketInput,
  validateCreateTicketInput,
} from "./ticket-validation.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // lets the Vite dev server on :5173 call this API
app.use(express.json());

app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: { id: true, displayName: true, email: true },
    });

    res.status(200).json({ data: requesters });
  } catch (error) {
    console.error("GET /api/requesters failed:", error);
    res.status(503).json({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Development Requesters are temporarily unavailable.",
      },
    });
  }
});

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
      where: { isActive: true },
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

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });

    res.status(200).json(systems);
  } catch (error) {
    console.error("GET /api/related-systems failed:", error);
    res.status(503).json({ error: "Database unavailable" });
  }
});

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  res.status(status).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

async function getActiveRequester(req: Request, res: Response) {
  const rawId = req.get("X-Requester-Id");
  if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
    sendError(
      res,
      400,
      "INVALID_REQUESTER_CONTEXT",
      "A valid Development Requester context is required.",
    );
    return null;
  }

  try {
    const requester = await getPrisma().requesterUser.findFirst({
      where: { id: Number(rawId), isActive: true },
      select: { id: true, displayName: true, email: true },
    });
    if (!requester) {
      sendError(
        res,
        400,
        "INVALID_REQUESTER_CONTEXT",
        "A valid Development Requester context is required.",
      );
      return null;
    }
    return requester;
  } catch (error) {
    console.error("Requester context lookup failed:", error);
    sendError(res, 503, "DEPENDENCY_UNAVAILABLE", "The database is temporarily unavailable.");
    return null;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002";
}

async function createTicket(
  requesterId: number,
  input: CreateTicketInput,
) {
  const prisma = getPrisma();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const nextDay = new Date(start);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const existingToday = await prisma.ticket.count({
    where: { createdAt: { gte: start, lt: nextDay } },
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const ticketNumber = formatTicketNumber(now, existingToday + attempt + 1);
    try {
      return await prisma.ticket.create({
        data: {
          ticketNumber,
          requesterId,
          categoryId: input.categoryId,
          relatedSystemId: input.relatedSystemId,
          summary: input.summary,
          description: input.description,
          requestedPriority: input.requestedPriority,
        },
        include: {
          requester: { select: { id: true, displayName: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
  }

  throw new Error("Unable to allocate a unique Ticket Number.");
}

app.post("/api/tickets", async (req: Request, res: Response) => {
  const requester = await getActiveRequester(req, res);
  if (!requester) return;

  const validation = validateCreateTicketInput(req.body);
  if (!validation.ok) {
    if (validation.fields.form) {
      sendError(res, 400, "MALFORMED_REQUEST", validation.fields.form);
      return;
    }
    sendError(
      res,
      422,
      "VALIDATION_ERROR",
      "Some fields are invalid.",
      validation.fields,
    );
    return;
  }

  try {
    const prisma = getPrisma();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({
        where: { id: validation.value.categoryId, isActive: true },
        select: { id: true },
      }),
      prisma.relatedSystem.findFirst({
        where: { id: validation.value.relatedSystemId, isActive: true },
        select: { id: true },
      }),
    ]);
    const fields: Record<string, string> = {};
    if (!category) fields.categoryId = "Category is invalid or inactive.";
    if (!relatedSystem) {
      fields.relatedSystemId = "Related System is invalid or inactive.";
    }
    if (Object.keys(fields).length > 0) {
      sendError(res, 422, "VALIDATION_ERROR", "Some fields are invalid.", fields);
      return;
    }

    const ticket = await createTicket(requester.id, validation.value);
    res.status(201).json({
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketDate: ticket.createdAt,
        requester: ticket.requester,
        category: ticket.category,
        relatedSystem: ticket.relatedSystem,
        summary: ticket.summary,
        requestedPriority: ticket.requestedPriority,
        itPriority: ticket.itPriority,
        currentStatus: ticket.currentStatus,
        description: ticket.description,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    });
  } catch (error) {
    console.error("POST /api/tickets failed:", error);
    sendError(res, 500, "INTERNAL_ERROR", "Ticket could not be created. Please try again.");
  }
});

export default app;
