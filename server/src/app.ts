import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { getPrisma } from "./prisma.js";
import {
  isAllowedOrigin,
  normalizeEmail,
  parseCookie,
  randomSecret,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sha256,
} from "./auth.js";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password.js";
import {
  findAvailableTicketNumber,
  formatTicketNumber,
} from "./ticket-number.js";
import {
  CreateTicketInput,
  validateCreateTicketInput,
} from "./ticket-validation.js";
import { parseTicketQuery } from "./ticket-query.js";
import { parseStaffQuery, StaffQuery } from "./staff-query.js";
import {
  MAX_ACTIVE_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  removalReasonError,
  validateAttachment,
} from "./attachment-validation.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

type AuthSession = {
  id: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
  user: { id: number; displayName: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean; mustChangePassword: boolean };
};

const loginAttempts = new Map<string, { failures: number; firstFailureAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;

function sendAuthError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

function safeCurrentUser(session: AuthSession) {
  return {
    id: session.user.id,
    displayName: session.user.displayName,
    email: session.user.email,
    role: session.user.role,
    isActive: true,
    mustChangePassword: session.user.mustChangePassword,
    sessionExpiresAt: session.expiresAt,
    csrfToken: session.csrfToken,
  };
}

async function currentSession(req: Request): Promise<AuthSession | null> {
  const token = parseCookie(req.get("cookie"), SESSION_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const session = await getPrisma().session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, displayName: true, email: true, role: true, isActive: true, mustChangePassword: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) return null;
  return session;
}

async function requireSession(req: Request, res: Response, allowPasswordChange = false): Promise<AuthSession | null> {
  try {
    const session = await currentSession(req);
    if (!session) {
      sendAuthError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
      return null;
    }
    if (!allowPasswordChange && session.user.mustChangePassword) {
      sendAuthError(res, 403, "PASSWORD_CHANGE_REQUIRED", "Change your initial password before continuing.");
      return null;
    }
    return session;
  } catch (error) {
    console.error("Authentication lookup failed:", error);
    sendAuthError(res, 503, "DEPENDENCY_UNAVAILABLE", "Authentication is temporarily unavailable.");
    return null;
  }
}

function sendForbidden(res: Response) {
  sendAuthError(res, 403, "FORBIDDEN", "You do not have permission to perform this action.");
}

async function requireRole(req: Request, res: Response, roles: AuthSession["user"]["role"][], allowPasswordChange = false): Promise<AuthSession | null> {
  const session = await requireSession(req, res, allowPasswordChange);
  if (!session) return null;
  if (!roles.includes(session.user.role)) {
    sendForbidden(res);
    return null;
  }
  return session;
}

async function requireRequester(req: Request, res: Response, unsafe = false): Promise<AuthSession | null> {
  const session = await requireRole(req, res, ["REQUESTER"]);
  if (!session) return null;
  if (unsafe && !originAndCsrfValid(req, res, session)) return null;
  return session;
}

function csrfValid(req: Request, session: AuthSession): boolean {
  const supplied = req.get("X-CSRF-Token");
  return Boolean(supplied && supplied.length === session.csrfToken.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(session.csrfToken)));
}

function originAndCsrfValid(req: Request, res: Response, session: AuthSession): boolean {
  if (!isAllowedOrigin(req.get("origin")) || !csrfValid(req, session)) {
    sendAuthError(res, 403, "CSRF_INVALID", "This request could not be verified.");
    return false;
  }
  return true;
}

function loginKey(email: string, ip: string): string {
  return `${email}\u0000${ip}`;
}

function limiterRetryAfter(key: string): number | null {
  const entry = loginAttempts.get(key);
  if (!entry) return null;
  const elapsed = Date.now() - entry.firstFailureAt;
  if (elapsed >= LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return null;
  }
  return entry.failures >= LOGIN_LIMIT ? Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000) : null;
}

function recordLoginFailure(key: string) {
  const now = Date.now();
  const prior = loginAttempts.get(key);
  if (!prior || now - prior.firstFailureAt >= LOGIN_WINDOW_MS) loginAttempts.set(key, { failures: 1, firstFailureAt: now });
  else loginAttempts.set(key, { ...prior, failures: prior.failures + 1 });
}

async function createSession(userId: number) {
  const token = randomSecret();
  const csrfToken = randomSecret();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const session = await getPrisma().session.create({ data: { tokenHash: sha256(token), csrfToken, userId, expiresAt } });
  return { token, session };
}

app.post("/api/auth/login", async (req: Request, res: Response) => {
  if (!isAllowedOrigin(req.get("origin"))) {
    sendAuthError(res, 403, "CSRF_INVALID", "This request could not be verified.");
    return;
  }
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 128) {
    sendAuthError(res, 400, "MALFORMED_REQUEST", "Email and password are required.");
    return;
  }
  const normalizedEmail = normalizeEmail(email);
  const key = loginKey(normalizedEmail, req.ip ?? "unknown");
  const retryAfter = limiterRetryAfter(key);
  if (retryAfter !== null) {
    res.setHeader("Retry-After", String(retryAfter));
    sendAuthError(res, 429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Try again later.");
    return;
  }
  try {
    const user = await getPrisma().user.findUnique({ where: { email: normalizedEmail }, include: { credential: true } });
    const passwordMatches = Boolean(user?.credential && await verifyPassword(user.credential.passwordHash, password));
    if (!user || !user.isActive || !passwordMatches) {
      recordLoginFailure(key);
      sendAuthError(res, 401, "AUTHENTICATION_FAILED", "Sign-in failed. Check your credentials or account status.");
      return;
    }
    loginAttempts.delete(key);
    const { token, session } = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(200).json({ data: { id: user.id, displayName: user.displayName, email: user.email, role: user.role, isActive: true, mustChangePassword: user.mustChangePassword, sessionExpiresAt: session.expiresAt, csrfToken: session.csrfToken } });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    sendAuthError(res, 503, "DEPENDENCY_UNAVAILABLE", "We could not sign you in right now. Try again.");
  }
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  const session = await requireSession(req, res, true);
  if (session) res.status(200).json({ data: safeCurrentUser(session) });
});

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  const session = await requireSession(req, res, true);
  if (!session || !originAndCsrfValid(req, res, session)) return;
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || currentPassword.length > 128 || newPassword.length > 128) {
    sendAuthError(res, 400, "MALFORMED_REQUEST", "Password values are required.");
    return;
  }
  const fields: Record<string, string> = {};
  const passwordError = passwordPolicyError(newPassword);
  if (passwordError) fields.newPassword = passwordError;
  try {
    const credential = await getPrisma().credential.findUnique({ where: { userId: session.user.id } });
    if (!credential || !await verifyPassword(credential.passwordHash, currentPassword)) fields.currentPassword = "Current password is incorrect.";
    else if (currentPassword === newPassword) fields.newPassword = "New password must differ from current password.";
    if (Object.keys(fields).length > 0) {
      sendAuthError(res, 422, "VALIDATION_ERROR", "Some fields are invalid.", fields);
      return;
    }
    const passwordHash = await hashPassword(newPassword);
    const token = randomSecret();
    const csrfToken = randomSecret();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
    await getPrisma().$transaction(async (tx) => {
      await tx.credential.update({ where: { userId: session.user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
      await tx.user.update({ where: { id: session.user.id }, data: { mustChangePassword: false } });
      await tx.session.updateMany({ where: { userId: session.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.session.create({ data: { tokenHash: sha256(token), csrfToken, userId: session.user.id, expiresAt } });
    });
    setSessionCookie(res, token);
    res.status(200).json({ data: { ...safeCurrentUser(session), mustChangePassword: false, sessionExpiresAt: expiresAt, csrfToken } });
  } catch (error) {
    console.error("POST /api/auth/change-password failed:", error);
    sendAuthError(res, 503, "DEPENDENCY_UNAVAILABLE", "We could not change your password right now. Try again.");
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const session = await currentSession(req);
    if (session) {
      if (!originAndCsrfValid(req, res, session)) return;
      await getPrisma().session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    }
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);
    sendAuthError(res, 503, "DEPENDENCY_UNAVAILABLE", "We could not sign you out. Try again.");
  }
});

app.get("/api/app", async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (session) res.status(200).json({ data: { role: session.user.role } });
});

const attachmentStorage = path.resolve(process.env.ATTACHMENT_STORAGE ?? "storage/attachments");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_ATTACHMENT_BYTES + 1 },
});

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
      ticket: { submittedByUserId: requesterId },
    },
    include: attachmentIncludes,
  });
}

async function readableTicket(ticketId: string, session: AuthSession) {
  return getPrisma().ticket.findFirst({
    where: session.user.role === "REQUESTER" ? { id: ticketId, submittedByUserId: session.user.id } : { id: ticketId },
    select: { id: true },
  });
}

async function readableAttachment(attachmentId: string, session: AuthSession) {
  return getPrisma().attachment.findFirst({
    where: session.user.role === "REQUESTER" ? { id: attachmentId, ticket: { submittedByUserId: session.user.id } } : { id: attachmentId },
    include: attachmentIncludes,
  });
}

async function removeStagedFile(storagePath: string) {
  await fs.rm(storagePath, { force: true }).catch(() => undefined);
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
          submittedByUserId: requesterId,
          categoryId: input.categoryId,
          relatedSystemId: input.relatedSystemId,
          summary: input.summary,
          description: input.description,
          requestedPriority: input.requestedPriority,
          itPriority: input.requestedPriority,
        },
        include: {
          submittedBy: { select: { id: true, displayName: true } },
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
  const session = await requireRequester(req, res, true);
  if (!session) return;

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

    const ticket = await createTicket(session.user.id, validation.value);
    res.status(201).json({
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketDate: ticket.createdAt,
        requester: ticket.submittedBy,
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
    const session = await requireRequester(req, res, true);
    if (!session) return;
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
      where: { id: ticketId, submittedByUserId: session.user.id },
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
            uploadedByUserId: session.user.id,
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
  const session = await requireSession(req, res);
  if (!session) return;
  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }
  try {
    const ticket = await readableTicket(ticketId, session);
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
  const session = await requireSession(req, res);
  if (!session) return;
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
    const attachment = await readableAttachment(attachmentId, session);
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
  const session = await requireRequester(req, res, true);
  if (!session) return;
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
    const attachment = await ownedAttachment(attachmentId, session.user.id);
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
        removedByUserId: session.user.id,
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

const ticketDetailInclude = {
  submittedBy: { select: { id: true, displayName: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: { include: attachmentIncludes },
} as const;

function sortAttachments<T extends { createdAt: Date; removedAt: Date | null }>(attachments: T[]): T[] {
  return [...attachments].sort((left, right) => {
    if (left.removedAt === null && right.removedAt !== null) return -1;
    if (left.removedAt !== null && right.removedAt === null) return 1;
    if (left.removedAt === null && right.removedAt === null) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }
    return right.removedAt!.getTime() - left.removedAt!.getTime();
  });
}

async function requesterTicketDetail(ticketId: string, requesterId: number) {
  const ticket = await getPrisma().ticket.findFirst({
    where: { id: ticketId, submittedByUserId: requesterId },
    include: ticketDetailInclude,
  });
  if (!ticket) return null;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.createdAt,
    requester: ticket.submittedBy,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    summary: ticket.summary,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    description: ticket.description,
    requesterResolvedAt: ticket.requesterResolvedAt,
    version: ticket.version,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    attachments: sortAttachments(ticket.attachments).map(attachmentMetadata),
  };
}

function ticketFailure(res: Response, error: unknown, label: string, message: string) {
  console.error(`${label} failed:`, error);
  sendError(
    res,
    isDependencyError(error) ? 503 : 500,
    isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR",
    isDependencyError(error) ? "Tickets are temporarily unavailable." : message,
  );
}

app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  const session = await requireRequester(req, res);
  if (!session) return;

  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }

  try {
    const detail = await requesterTicketDetail(ticketId, session.user.id);
    if (!detail) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }
    res.status(200).json({ data: detail });
  } catch (error) {
    ticketFailure(res, error, "GET /api/tickets/:ticketId", "Ticket could not be loaded. Please try again.");
  }
});

// ---------------------------------------------------------------------------
// Public Comments and Problem Appears Resolved (Issue #34)
// ---------------------------------------------------------------------------
const MAX_COMMENT_LENGTH = 2000;
const commentInclude = { author: { select: { id: true, displayName: true } } } as const;

function publicCommentView(comment: { id: string; content: string; createdAt: Date; author: { id: number; displayName: string } }) {
  return { id: comment.id, content: comment.content, author: comment.author, createdAt: comment.createdAt };
}

function onlyKeys(body: unknown, allowed: string): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body) && Object.keys(body).every((key) => key === allowed);
}

app.get("/api/tickets/:ticketId/comments", async (req: Request, res: Response) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }
  try {
    const ticket = await readableTicket(ticketId, session);
    if (!ticket) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }
    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: commentInclude,
    });
    res.status(200).json({ data: comments.map(publicCommentView) });
  } catch (error) {
    ticketFailure(res, error, "GET comments", "Comments could not be loaded.");
  }
});

app.post("/api/tickets/:ticketId/comments", async (req: Request, res: Response) => {
  const session = await requireRole(req, res, ["REQUESTER", "IT_STAFF"]);
  if (!session || !originAndCsrfValid(req, res, session)) return;
  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }
  const body = req.body;
  if (!onlyKeys(body, "content")) {
    sendError(res, 400, "MALFORMED_REQUEST", "Only content may be supplied.");
    return;
  }
  try {
    const ticket = await readableTicket(ticketId, session);
    if (!ticket) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const length = Array.from(content).length;
    if (length === 0) {
      sendError(res, 422, "VALIDATION_ERROR", "Some fields are invalid.", { content: "Comment is required." });
      return;
    }
    if (length > MAX_COMMENT_LENGTH) {
      sendError(res, 422, "VALIDATION_ERROR", "Some fields are invalid.", { content: `Comment must contain ${MAX_COMMENT_LENGTH} characters or fewer.` });
      return;
    }
    const comment = await getPrisma().publicComment.create({
      data: { ticketId, authorId: session.user.id, content },
      include: commentInclude,
    });
    res.status(201).json({ data: publicCommentView(comment) });
  } catch (error) {
    ticketFailure(res, error, "POST comment", "Comment could not be posted. Please try again.");
  }
});

app.post("/api/tickets/:ticketId/problem-appears-resolved", async (req: Request, res: Response) => {
  const session = await requireRequester(req, res, true);
  if (!session) return;
  const { ticketId } = req.params;
  if (!UUID_PATTERN.test(ticketId)) {
    sendError(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a valid UUID.");
    return;
  }
  const body = req.body;
  if (!onlyKeys(body, "version")) {
    sendError(res, 400, "MALFORMED_REQUEST", "Only version may be supplied.");
    return;
  }
  const version = body.version;
  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, submittedByUserId: session.user.id },
      select: { currentStatus: true, requesterResolvedAt: true, version: true },
    });
    if (!ticket) {
      sendError(res, 404, "RESOURCE_NOT_FOUND", "Ticket was not found.");
      return;
    }
    if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
      sendError(res, 422, "VALIDATION_ERROR", "Some fields are invalid.", { version: "Version must be a non-negative integer." });
      return;
    }
    if (ticket.currentStatus !== "WAITING_FOR_REQUESTER") {
      sendError(res, 409, "INVALID_TICKET_STATE", "This Ticket is not waiting for your response.");
      return;
    }
    if (ticket.requesterResolvedAt) {
      sendError(res, 409, "RESOLUTION_ALREADY_INDICATED", "You have already indicated that the problem appears resolved.");
      return;
    }
    if (ticket.version !== version) {
      sendError(res, 409, "STALE_TICKET", "This Ticket changed. Refresh and try again.");
      return;
    }
    const updated = await prisma.ticket.updateMany({
      where: { id: ticketId, version, currentStatus: "WAITING_FOR_REQUESTER", requesterResolvedAt: null },
      data: { requesterResolvedAt: new Date(), requesterResolvedByUserId: session.user.id, version: { increment: 1 } },
    });
    if (updated.count === 0) {
      sendError(res, 409, "STALE_TICKET", "This Ticket changed. Refresh and try again.");
      return;
    }
    res.status(200).json({ data: await requesterTicketDetail(ticketId, session.user.id) });
  } catch (error) {
    ticketFailure(res, error, "POST problem-appears-resolved", "The request could not be recorded. Please try again.");
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  const session = await requireRequester(req, res);
  if (!session) return;

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
      submittedByUserId: session.user.id,
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

// ---------------------------------------------------------------------------
// IT Staff Ticket Queue (Issue #35). Registered before the generic /api/staff/*
// guard below so this read-only route is the one that answers.
// ---------------------------------------------------------------------------
app.get("/api/staff/tickets", async (req: Request, res: Response) => {
  const session = await requireRole(req, res, ["IT_STAFF", "ADMINISTRATOR"]);
  if (!session) return;

  let query: StaffQuery;
  try {
    query = parseStaffQuery(req.query as Record<string, unknown>);
  } catch {
    sendError(res, 400, "INVALID_QUERY", "One or more ticket query parameters are invalid.");
    return;
  }

  try {
    const prisma = getPrisma();
    const invalid = () => sendError(res, 400, "INVALID_QUERY", "One or more ticket query parameters are invalid.");
    if (query.categoryId && !await prisma.category.findFirst({ where: { id: query.categoryId, isActive: true }, select: { id: true } })) return invalid();
    if (query.relatedSystemId && !await prisma.relatedSystem.findFirst({ where: { id: query.relatedSystemId, isActive: true }, select: { id: true } })) return invalid();
    if (typeof query.owner === "number" && !await prisma.user.findFirst({ where: { id: query.owner, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } }, select: { id: true } })) return invalid();

    const ownerFilter: Prisma.TicketWhereInput =
      query.owner === "me" ? { ownerId: session.user.id }
        : query.owner === "unassigned" ? { ownerId: null }
          : typeof query.owner === "number" ? { ownerId: query.owner } : {};
    const where: Prisma.TicketWhereInput = {
      ...(query.search ? { OR: [
        { ticketNumber: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
        { submittedBy: { displayName: { contains: query.search, mode: "insensitive" } } },
        { submittedBy: { email: { contains: query.search, mode: "insensitive" } } },
      ] } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.relatedSystemId ? { relatedSystemId: query.relatedSystemId } : {}),
      ...(query.status ? { currentStatus: query.status } : {}),
      ...(query.requestedPriority ? { requestedPriority: query.requestedPriority } : {}),
      ...(query.itPriority ? { itPriority: query.itPriority } : {}),
      ...ownerFilter,
    };
    const sortField = query.sortBy === "status" ? "currentStatus" : query.sortBy;
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [{ [sortField]: query.sortOrder }, { id: query.sortOrder }];
    const [totalItems, tickets, total, unassigned, mine] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true, ticketNumber: true, summary: true,
          submittedBy: { select: { id: true, displayName: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requestedPriority: true, itPriority: true, currentStatus: true,
          owner: { select: { id: true, displayName: true, role: true } },
          requesterResolvedAt: true, createdAt: true, updatedAt: true, version: true,
        },
      }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { ownerId: null } }),
      prisma.ticket.count({ where: { ownerId: session.user.id } }),
    ]);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);
    res.status(200).json({
      data: tickets.map(({ submittedBy, ...ticket }) => ({ ...ticket, requester: submittedBy })),
      pagination: {
        page: query.page, pageSize: query.pageSize, totalItems, totalPages,
        hasPreviousPage: query.page > 1, hasNextPage: query.page < totalPages,
      },
      counts: { total, unassigned, mine },
    });
  } catch (error) {
    ticketFailure(res, error, "GET /api/staff/tickets", "Tickets could not be loaded. Please try again.");
  }
});

// These endpoint families are implemented by later Lab 3 issues. Keeping the
// authorization boundary here makes direct calls fail safely now, rather than
// relying on the client shell to hide unfinished destinations.
app.all("/api/staff/assignees", async (req: Request, res: Response) => {
  const session = await requireRole(req, res, ["IT_STAFF"]);
  if (!session) return;
  sendError(res, 501, "NOT_IMPLEMENTED", "This Staff capability is not available yet.");
});

app.all("/api/staff/*", async (req: Request, res: Response) => {
  const session = await requireRole(req, res, ["IT_STAFF", "ADMINISTRATOR"]);
  if (!session) return;
  sendError(res, 501, "NOT_IMPLEMENTED", "This Staff capability is not available yet.");
});

app.all("/api/admin/*", async (req: Request, res: Response) => {
  const session = await requireRole(req, res, ["ADMINISTRATOR"]);
  if (!session) return;
  sendError(res, 501, "NOT_IMPLEMENTED", "This Administrator capability is not available yet.");
});

export default app;
