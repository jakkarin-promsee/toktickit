import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import {
  findAvailableTicketNumber,
  formatTicketNumber,
} from "./ticket-number.js";
import {
  CreateTicketInput,
  validateCreateTicketInput,
} from "./ticket-validation.js";
import { parseTicketQuery } from "./ticket-query.js";
import {
  MAX_ACTIVE_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  removalReasonError,
  validateAttachment,
} from "./attachment-validation.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // lets the Vite dev server on :5173 call this API
app.use(express.json());

const attachmentStorage = path.resolve(process.env.ATTACHMENT_STORAGE ?? "storage/attachments");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_ATTACHMENT_BYTES + 1 },
});

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

function attachmentMetadata(attachment: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
  uploadedBy: { displayName: string };
  removedBy: { displayName: string } | null;
}) {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    state: attachment.removedAt ? "REMOVED" : "ACTIVE",
    uploadedByDisplayName: attachment.uploadedBy.displayName,
    createdAt: attachment.createdAt,
    removedAt: attachment.removedAt,
    removedByDisplayName: attachment.removedBy?.displayName ?? null,
    removalReason: attachment.removalReason,
  };
}

const attachmentIncludes = {
  uploadedBy: { select: { displayName: true } },
  removedBy: { select: { displayName: true } },
} as const;

function attachmentNotFound(res: Response) {
  sendError(res, 404, "RESOURCE_NOT_FOUND", "Attachment was not found.");
}

async function ownedAttachment(
  attachmentId: string,
  requesterId: number,
) {
  return getPrisma().attachment.findFirst({
    where: {
      id: attachmentId,
      ticket: { requesterId },
    },
    include: attachmentIncludes,
  });
}

async function removeStagedFile(storagePath: string) {
  await fs.rm(storagePath, { force: true }).catch(() => undefined);
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

function isDependencyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1002", "P2024"].includes(error.code))
  );
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uploadMiddleware(req: Request, res: Response, next: () => void) {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      sendError(res, 413, "ATTACHMENT_TOO_LARGE", "Attachment must be 5 MB or smaller.");
      return;
    }
    sendError(res, 400, "MALFORMED_REQUEST", "Exactly one file is required.");
  });
}

app.post(
  "/api/tickets/:ticketId/attachments",
  uploadMiddleware,
  async (req: Request, res: Response) => {
    const requester = await getActiveRequester(req, res);
    if (!requester) return;
    const { ticketId } = req.params;
    if (!UUID_PATTERN.test(ticketId)) {
      sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
      return;
    }
    if (!req.file) {
      sendError(res, 400, "MALFORMED_REQUEST", "Exactly one file is required.");
      return;
    }

    const validation = validateAttachment(req.file);
    if (!validation.ok) {
      sendError(
        res,
        validation.status,
        validation.status === 413 ? "ATTACHMENT_TOO_LARGE" : "UNSUPPORTED_ATTACHMENT",
        validation.message,
      );
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId: requester.id },
      select: { id: true },
    });
    if (!ticket) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }

    const storageName = `${crypto.randomUUID()}${validation.value.extension}`;
    const storagePath = path.join(attachmentStorage, storageName);
    try {
      await fs.mkdir(attachmentStorage, { recursive: true });
      await fs.writeFile(storagePath, req.file.buffer, { flag: "wx" });
    } catch (error) {
      await removeStagedFile(storagePath);
      console.error("Attachment staging failed:", error);
      sendError(res, 503, "ATTACHMENT_UNAVAILABLE", "Attachment storage is temporarily unavailable.");
      return;
    }

    try {
      const attachment = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${ticketId}))`);
        const activeCount = await tx.attachment.count({
          where: { ticketId, removedAt: null },
        });
        if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
          throw new Error("ATTACHMENT_LIMIT_REACHED");
        }
        return tx.attachment.create({
          data: {
            ticketId,
            originalName: validation.value.originalName,
            storageName,
            mimeType: validation.value.mimeType,
            sizeBytes: validation.value.sizeBytes,
            sha256: crypto.createHash("sha256").update(req.file!.buffer).digest("hex"),
            uploadedByRequesterId: requester.id,
          },
          include: attachmentIncludes,
        });
      });

      res.status(201).json({ data: attachmentMetadata(attachment) });
    } catch (error) {
      await removeStagedFile(storagePath);
      if (error instanceof Error && error.message === "ATTACHMENT_LIMIT_REACHED") {
        sendError(res, 422, "ATTACHMENT_LIMIT_REACHED", "A Ticket may have at most five active attachments.");
        return;
      }
      console.error("POST attachment failed:", error);
      sendError(
        res,
        isDependencyError(error) ? 503 : 500,
        isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR",
        "Attachment could not be uploaded. Please try again.",
      );
    }
  },
);

app.get("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
  const requester = await getActiveRequester(req, res);
  if (!requester) return;
  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id: ticketId, requesterId: requester.id },
      select: { id: true },
    });
    if (!ticket) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }
    const attachments = await getPrisma().attachment.findMany({
      where: { ticketId },
      include: attachmentIncludes,
    });
    attachments.sort((left, right) => {
      if (left.removedAt === null && right.removedAt !== null) return -1;
      if (left.removedAt !== null && right.removedAt === null) return 1;
      if (left.removedAt === null && right.removedAt === null) {
        return left.createdAt.getTime() - right.createdAt.getTime();
      }
      return right.removedAt!.getTime() - left.removedAt!.getTime();
    });
    res.status(200).json({ data: attachments.map(attachmentMetadata) });
  } catch (error) {
    console.error("GET attachments failed:", error);
    sendError(res, isDependencyError(error) ? 503 : 500, isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR", "Attachments could not be loaded.");
  }
});

app.get("/api/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  const requester = await getActiveRequester(req, res);
  if (!requester) return;
  const { attachmentId } = req.params;
  if (!UUID_PATTERN.test(attachmentId)) {
    sendError(res, 400, "INVALID_ATTACHMENT_ID", "Attachment ID must be a valid UUID.");
    return;
  }
  if (req.query.disposition !== undefined && req.query.disposition !== "inline" && req.query.disposition !== "attachment") {
    sendError(res, 400, "INVALID_QUERY", "Disposition must be inline or attachment.");
    return;
  }
  try {
    const attachment = await ownedAttachment(attachmentId, requester.id);
    if (!attachment) {
      attachmentNotFound(res);
      return;
    }
    if (attachment.removedAt) {
      sendError(res, 410, "ATTACHMENT_REMOVED", "Attachment has been removed.");
      return;
    }
    const storagePath = path.join(attachmentStorage, attachment.storageName);
    const root = path.resolve(attachmentStorage);
    if (!path.resolve(storagePath).startsWith(`${root}${path.sep}`)) {
      sendError(res, 503, "ATTACHMENT_UNAVAILABLE", "Attachment is temporarily unavailable.");
      return;
    }
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(storagePath);
    } catch {
      sendError(res, 503, "ATTACHMENT_UNAVAILABLE", "Attachment is temporarily unavailable.");
      return;
    }
    const disposition = req.query.disposition === "inline" ? "inline" : "attachment";
    const safeName = attachment.originalName.replace(/["\\\r\n]/g, "_");
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", bytes.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${disposition}; filename="download"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    res.status(200).send(bytes);
  } catch (error) {
    console.error("GET attachment download failed:", error);
    sendError(res, isDependencyError(error) ? 503 : 500, isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR", "Attachment could not be downloaded.");
  }
});

app.delete("/api/attachments/:attachmentId", async (req: Request, res: Response) => {
  const requester = await getActiveRequester(req, res);
  if (!requester) return;
  const { attachmentId } = req.params;
  if (!UUID_PATTERN.test(attachmentId)) {
    sendError(res, 400, "INVALID_ATTACHMENT_ID", "Attachment ID must be a valid UUID.");
    return;
  }
  const reasonError = removalReasonError(req.body?.reason);
  if (reasonError) {
    sendError(res, 422, "VALIDATION_ERROR", "Some fields are invalid.", { reason: reasonError });
    return;
  }
  try {
    const attachment = await ownedAttachment(attachmentId, requester.id);
    if (!attachment) {
      attachmentNotFound(res);
      return;
    }
    if (attachment.removedAt) {
      sendError(res, 409, "ATTACHMENT_ALREADY_REMOVED", "Attachment has already been removed.");
      return;
    }
    const updated = await getPrisma().attachment.update({
      where: { id: attachmentId },
      data: {
        removedAt: new Date(),
        removedByRequesterId: requester.id,
        removalReason: req.body.reason.trim(),
      },
      include: attachmentIncludes,
    });
    res.status(200).json({ data: attachmentMetadata(updated) });
  } catch (error) {
    console.error("DELETE attachment failed:", error);
    sendError(res, isDependencyError(error) ? 503 : 500, isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR", "Attachment could not be removed.");
  }
});

app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  const requester = await getActiveRequester(req, res);
  if (!requester) return;

  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }

  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: {
        id: ticketId,
        requesterId: requester.id,
      },
      include: {
        requester: { select: { id: true, displayName: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          include: {
            uploadedBy: { select: { displayName: true } },
            removedBy: { select: { displayName: true } },
          },
        },
      },
    });

    if (!ticket) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }

    const attachments = [...ticket.attachments]
      .sort((left, right) => {
        if (left.removedAt === null && right.removedAt !== null) return -1;
        if (left.removedAt !== null && right.removedAt === null) return 1;
        if (left.removedAt === null && right.removedAt === null) {
          return left.createdAt.getTime() - right.createdAt.getTime();
        }
        return right.removedAt!.getTime() - left.removedAt!.getTime();
      })
      .map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        state: attachment.removedAt ? "REMOVED" : "ACTIVE",
        uploadedByDisplayName: attachment.uploadedBy.displayName,
        createdAt: attachment.createdAt,
        removedAt: attachment.removedAt,
        removedByDisplayName: attachment.removedBy?.displayName ?? null,
        removalReason: attachment.removalReason,
      }));

    res.status(200).json({
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
        attachments,
      },
    });
  } catch (error) {
    console.error("GET /api/tickets/:ticketId failed:", error);
    sendError(
      res,
      isDependencyError(error) ? 503 : 500,
      isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR",
      isDependencyError(error)
        ? "Tickets are temporarily unavailable."
        : "Ticket could not be loaded. Please try again.",
    );
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  const requester = await getActiveRequester(req, res);
  if (!requester) return;

  let query;
  try {
    query = parseTicketQuery(req.query as Record<string, unknown>);
  } catch {
    sendError(
      res,
      400,
      "INVALID_QUERY",
      "One or more ticket query parameters are invalid.",
    );
    return;
  }

  try {
    const where: Prisma.TicketWhereInput = {
      requesterId: requester.id,
      ...(query.search
        ? {
            OR: [
              { ticketNumber: { contains: query.search, mode: "insensitive" } },
              { summary: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.relatedSystemId
        ? { relatedSystemId: query.relatedSystemId }
        : {}),
      ...(query.status ? { currentStatus: query.status } : {}),
      ...(query.requestedPriority
        ? { requestedPriority: query.requestedPriority }
        : {}),
    };
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
      { [query.sortBy]: query.sortOrder },
      { id: query.sortOrder },
    ];
    const skip = (query.page - 1) * query.pageSize;
    const prisma = getPrisma();
    const [totalItems, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

    res.status(200).json({
      data: tickets,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: query.page > 1,
        hasNextPage: query.page < totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/tickets failed:", error);
    sendError(
      res,
      isDependencyError(error) ? 503 : 500,
      isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR",
      isDependencyError(error)
        ? "Tickets are temporarily unavailable."
        : "Tickets could not be loaded. Please try again.",
    );
  }
});

export default app;
