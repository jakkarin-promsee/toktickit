import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { parseActionContent, validVersion } from "./action-validation.js";

type Session = { id: string; tokenHash: string; csrfToken: string; expiresAt: Date; user: { id: number; displayName: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean; mustChangePassword: boolean } };
type Dependencies = {
  requireRole: (req: Request, res: Response, roles: Session["user"]["role"][]) => Promise<Session | null>;
  originAndCsrfValid: (req: Request, res: Response, session: Session) => boolean;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const activeTicket = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const personSelect = { id: true, displayName: true, role: true } as const;
const actionInclude = { performedBy: { select: personSelect }, assignee: { select: personSelect }, createdBy: { select: personSelect }, completedBy: { select: personSelect }, cancelledBy: { select: personSelect } } as const;

class ActionError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}
const fail = (status: number, code: string, message: string, fields?: Record<string, string>): never => { throw new ActionError(status, code, message, fields); };
const missing = (): never => fail(404, "RESOURCE_NOT_FOUND", "Resource was not found.");
const staleTicket = (): never => fail(409, "STALE_TICKET", "This Ticket changed. Refresh before trying again.");
const staleAction = (): never => fail(409, "STALE_ACTION", "This action changed. Refresh before trying again.");
const validation = (fields: Record<string, string>): never => fail(422, "VALIDATION_ERROR", "Some fields are invalid.", fields);

function sendFailure(res: Response, error: unknown) {
  if (error instanceof ActionError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } });
  } else {
    console.error("Actions Taken request failed:", error);
    const dependency = error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientInitializationError;
    res.status(dependency ? 503 : 500).json({ error: { code: dependency ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR", message: "The request could not be completed. Please try again." } });
  }
}

function checkIds(req: Request) {
  if (!uuid.test(req.params.ticketId) || (req.params.actionId && !uuid.test(req.params.actionId))) fail(400, "MALFORMED_REQUEST", "Resource ID must be a valid UUID.");
  if (Object.keys(req.query).length) fail(400, "INVALID_QUERY", "Query parameters are not supported.");
}

function checkBody(req: Request, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Buffer.byteLength(JSON.stringify(req.body)) > 32768 || Object.keys(req.body).some((key) => !required.includes(key) && !optional.includes(key)) || required.some((key) => !(key in req.body))) fail(400, "MALFORMED_REQUEST", "The request body is not valid.");
  return req.body as Record<string, unknown>;
}

function versions(body: Record<string, unknown>, action = false) {
  if (!validVersion(body.ticketVersion)) validation({ ticketVersion: "Enter a non-negative version." });
  if (action && !validVersion(body.actionVersion)) validation({ actionVersion: "Enter a non-negative version." });
}

async function ticketFor(tx: Prisma.TransactionClient, ticketId: string, session: Session) {
  const ticket = await tx.ticket.findFirst({ where: { id: ticketId, ...(session.user.role === "REQUESTER" ? { submittedByUserId: session.user.id } : {}) } });
  if (!ticket) return missing();
  return ticket;
}

function actionView(action: Prisma.ActionTakenGetPayload<{ include: typeof actionInclude }>, ticketVersion: number, requester: boolean) {
  const base = {
    id: action.id, ticketId: action.ticketId, actionAt: action.actionAt.toISOString(), description: action.description, result: action.result,
    status: action.status, performedBy: requester ? { displayName: action.performedBy.displayName } : action.performedBy,
    assignee: requester ? (action.assignee ? { displayName: action.assignee.displayName } : null) : action.assignee,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes,
    createdAt: action.createdAt.toISOString(), updatedAt: action.updatedAt.toISOString(), completedAt: action.completedAt?.toISOString() ?? null, cancelledAt: action.cancelledAt?.toISOString() ?? null,
  };
  return requester ? base : { ...base, createdBy: action.createdBy, completedBy: action.completedBy, cancelledBy: action.cancelledBy, cancellationReason: action.cancellationReason, version: action.version, ticketVersion };
}

async function assigneeFor(tx: Prisma.TransactionClient, id: unknown) {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) validation({ assigneeId: "Select an eligible assignee." });
  const user = await tx.user.findUnique({ where: { id: id as number }, select: { id: true, role: true, isActive: true } });
  if (!user || !["IT_STAFF", "ADMINISTRATOR"].includes(user.role)) return fail(422, "INVALID_ASSIGNEE", "Select an eligible IT Staff or Administrator.");
  if (!user.isActive) return fail(422, "INACTIVE_ASSIGNEE", "The selected assignee is inactive.");
  return user;
}

function changes(before: Record<string, unknown>, after: Record<string, unknown>) {
  const result: Record<string, { before: string | number | boolean | null; after: string | number | boolean | null }> = {};
  for (const [key, value] of Object.entries(after)) {
    const old = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key] ?? null;
    const next = value instanceof Date ? value.toISOString() : value ?? null;
    if (old !== next) result[key] = { before: old as string | number | boolean | null, after: next as string | number | boolean | null };
  }
  return result;
}

async function appendEvents(tx: Prisma.TransactionClient, ticketId: string, actionId: string, actorId: number, type: "CREATED" | "EDITED" | "ASSIGNED" | "STATUS_CHANGED" | "COMPLETED" | "CANCELLED", actionVersion: number, ticketVersion: number, diff: ReturnType<typeof changes>) {
  const occurredAt = new Date();
  await tx.actionEvent.create({ data: { actionId, ticketId, actorId, type, occurredAt, resultingActionVersion: actionVersion, resultingTicketVersion: ticketVersion, changes: diff } });
  await tx.ticketWorkflowEvent.create({ data: { ticketId, actorId, type: "ACTION_CHANGED", subjectActionId: actionId, occurredAt, resultingTicketVersion: ticketVersion, changes: diff } });
}

export function registerActionRoutes(app: Express, deps: Dependencies) {
  async function run(req: Request, res: Response, write: boolean, staffOnly: boolean, handler: (session: Session) => Promise<void>) {
    const session = await deps.requireRole(req, res, staffOnly || write ? ["IT_STAFF", "ADMINISTRATOR"] : ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]);
    if (!session) return;
    if (write && !deps.originAndCsrfValid(req, res, session)) return;
    try { checkIds(req); await handler(session); } catch (error) { sendFailure(res, error); }
  }

  app.get("/api/tickets/:ticketId/actions", (req, res) => run(req, res, false, false, async (session) => {
    const ticket = await ticketFor(getPrisma(), req.params.ticketId, session);
    const actions = await getPrisma().actionTaken.findMany({ where: { ticketId: ticket.id }, include: actionInclude, orderBy: [{ actionAt: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
    res.json({ data: actions.map((item) => actionView(item, ticket.version, session.user.role === "REQUESTER")) });
  }));

  app.get("/api/tickets/:ticketId/actions/:actionId", (req, res) => run(req, res, false, false, async (session) => {
    const ticket = await ticketFor(getPrisma(), req.params.ticketId, session);
    const action = await getPrisma().actionTaken.findFirst({ where: { id: req.params.actionId, ticketId: ticket.id }, include: actionInclude });
    if (!action) return missing();
    res.json({ data: actionView(action, ticket.version, session.user.role === "REQUESTER") });
  }));

  app.get("/api/tickets/:ticketId/actions/:actionId/events", (req, res) => run(req, res, false, true, async (session) => {
    await ticketFor(getPrisma(), req.params.ticketId, session);
    const action = await getPrisma().actionTaken.findFirst({ where: { id: req.params.actionId, ticketId: req.params.ticketId }, select: { id: true } });
    if (!action) return missing();
    const events = await getPrisma().actionEvent.findMany({ where: { actionId: action.id }, include: { actor: { select: personSelect } }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
    res.json({ data: events.map((item) => ({ id: item.id, type: item.type, actor: item.actor, occurredAt: item.occurredAt.toISOString(), resultingActionVersion: item.resultingActionVersion, resultingTicketVersion: item.resultingTicketVersion, changes: item.changes })) });
  }));

  app.post("/api/tickets/:ticketId/actions", (req, res) => run(req, res, true, true, async (session) => {
    const body = checkBody(req, ["ticketVersion", "actionAt", "description", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes"], ["result"]);
    versions(body);
    const key = req.get("Idempotency-Key");
    if (!key || !uuid.test(key)) return fail(400, "MALFORMED_REQUEST", "Idempotency-Key must be a UUID.");
    const ticket = await ticketFor(getPrisma(), req.params.ticketId, session);
    const parsed = parseActionContent(body, ticket.createdAt);
    if (!parsed.value) return validation(parsed.fields);
    const value = parsed.value;
    if (body.assigneeId !== null && (typeof body.assigneeId !== "number" || !Number.isSafeInteger(body.assigneeId))) validation({ assigneeId: "Select an eligible assignee or null." });
    const payload = { ticketVersion: body.ticketVersion, ...value, actionAt: value.actionAt.toISOString(), assigneeId: body.assigneeId };
    const requestHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const create = async () => getPrisma().$transaction(async (tx) => {
      const replay = await tx.actionCreateRequest.findUnique({ where: { actorId_ticketId_idempotencyKey: { actorId: session.user.id, ticketId: ticket.id, idempotencyKey: key } } });
      if (replay) {
        if (replay.requestHash !== requestHash) fail(409, "IDEMPOTENCY_KEY_REUSED", "This idempotency key was used for another request.");
        return replay.response as { data: ReturnType<typeof actionView> };
      }
      const current = await ticketFor(tx, ticket.id, session);
      if (current.version !== body.ticketVersion) staleTicket();
      if (!activeTicket.includes(current.currentStatus)) fail(409, "ACTION_TICKET_CLOSED", "Actions cannot be changed on this Ticket.");
      if (body.assigneeId !== null) await assigneeFor(tx, body.assigneeId);
      const bumped = await tx.ticket.updateMany({ where: { id: ticket.id, version: current.version, currentStatus: current.currentStatus }, data: { version: { increment: 1 } } });
      if (!bumped.count) staleTicket();
      const action = await tx.actionTaken.create({ data: { ticketId: ticket.id, ...value, assigneeId: body.assigneeId as number | null, createdByUserId: session.user.id, performedByUserId: session.user.id }, include: actionInclude });
      const diff = changes({}, { actionAt: action.actionAt, description: action.description, result: action.result, status: action.status, assigneeId: action.assigneeId, followUpRequired: action.followUpRequired, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes });
      await appendEvents(tx, ticket.id, action.id, session.user.id, "CREATED", 0, current.version + 1, diff);
      const response = { data: actionView(action, current.version + 1, false) };
      await tx.actionCreateRequest.create({ data: { actorId: session.user.id, ticketId: ticket.id, idempotencyKey: key, requestHash, actionId: action.id, response: response as Prisma.InputJsonValue } });
      return response;
    });
    let response;
    try { response = await create(); } catch (error) {
      const collision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      const concurrentReplay = error instanceof ActionError && error.code === "STALE_TICKET";
      if (!collision && !concurrentReplay) throw error;
      const replay = await getPrisma().actionCreateRequest.findUnique({ where: { actorId_ticketId_idempotencyKey: { actorId: session.user.id, ticketId: ticket.id, idempotencyKey: key } } });
      if (!replay) throw error;
      if (replay.requestHash !== requestHash) fail(409, "IDEMPOTENCY_KEY_REUSED", "This idempotency key was used for another request.");
      response = replay.response;
    }
    res.location(`/api/tickets/${ticket.id}/actions/${(response as { data: { id: string } }).data.id}`).status(201).json(response);
  }));

  async function mutate(req: Request, res: Response, kind: "edit" | "assignee" | "status", session: Session) {
    const body = kind === "edit" ? checkBody(req, ["ticketVersion", "actionVersion", "actionAt", "description", "result", "followUpRequired", "followUpNote", "attachmentNotes"]) : kind === "assignee" ? checkBody(req, ["ticketVersion", "actionVersion", "assigneeId"]) : checkBody(req, ["ticketVersion", "actionVersion", "status"], ["reason"]);
    versions(body, true);
    const response = await getPrisma().$transaction(async (tx) => {
      const ticket = await ticketFor(tx, req.params.ticketId, session);
      const action = await tx.actionTaken.findFirst({ where: { id: req.params.actionId, ticketId: ticket.id } });
      if (!action) return missing();
      if (ticket.version !== body.ticketVersion) staleTicket();
      if (action.version !== body.actionVersion) staleAction();
      if (!activeTicket.includes(ticket.currentStatus)) fail(409, "ACTION_TICKET_CLOSED", "Actions cannot be changed on this Ticket.");
      if (["COMPLETED", "CANCELLED"].includes(action.status)) fail(409, "INVALID_ACTION_TRANSITION", "This action can no longer be changed.");
      const actorId = session.user.id;
      const actorAllowed = action.assigneeId === actorId || ticket.ownerId === actorId || (action.assigneeId === null && action.status === "PLANNED" && action.createdByUserId === actorId);
      let data: Prisma.ActionTakenUncheckedUpdateManyInput = {};
      let eventType: "EDITED" | "ASSIGNED" | "STATUS_CHANGED" | "COMPLETED" | "CANCELLED";
      let diff: ReturnType<typeof changes>;
      if (kind === "edit") {
        if (!actorAllowed) fail(403, "FORBIDDEN", "You do not have permission to perform this action.");
        const parsed = parseActionContent(body, ticket.createdAt);
        if (!parsed.value) return validation(parsed.fields);
        data = parsed.value;
        diff = changes(action, parsed.value);
        eventType = "EDITED";
      } else if (kind === "assignee") {
        if (body.assigneeId === null) validation({ assigneeId: "Select an eligible assignee." });
        const assignee = await assigneeFor(tx, body.assigneeId);
        if (assignee.id === action.assigneeId) fail(409, "ASSIGNMENT_UNCHANGED", "This action is already assigned to that user.");
        data = { assigneeId: assignee.id };
        diff = changes(action, { assigneeId: assignee.id });
        eventType = "ASSIGNED";
      } else {
        if (!actorAllowed) fail(403, "FORBIDDEN", "You do not have permission to perform this action.");
        const target = body.status;
        if (typeof target !== "string" || !["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(target) || !((action.status === "PLANNED" && ["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(target)) || (action.status === "IN_PROGRESS" && ["COMPLETED", "CANCELLED"].includes(target)))) fail(409, "INVALID_ACTION_TRANSITION", "That action status change is not permitted.");
        if (target === "CANCELLED") {
          if (typeof body.reason !== "string" || !body.reason.trim() || Array.from(body.reason.trim()).length > 500) validation({ reason: "Enter a cancellation reason of 1–500 characters." });
          data = { status: "CANCELLED", cancelledAt: new Date(), cancelledByUserId: actorId, cancellationReason: (body.reason as string).trim() };
          eventType = "CANCELLED";
        } else {
          if ("reason" in body) fail(400, "MALFORMED_REQUEST", "Reason is only allowed for cancellation.");
          if (action.assigneeId === null) fail(409, "ACTION_ASSIGNEE_REQUIRED", "Assign this action first.");
          await assigneeFor(tx, action.assigneeId);
          if (target === "COMPLETED") {
            if (!action.result.trim()) validation({ result: "Enter a result before completing." });
            if (action.followUpRequired && !action.followUpNote?.trim()) validation({ followUpNote: "Enter a follow-up note." });
            data = { status: "COMPLETED", completedAt: new Date(), completedByUserId: actorId, completedTicketVersion: ticket.version + 1 };
            eventType = "COMPLETED";
          } else {
            data = { status: "IN_PROGRESS" };
            eventType = "STATUS_CHANGED";
          }
        }
        diff = changes(action, { status: target, ...(target === "CANCELLED" ? { cancellationReason: body.reason as string } : {}) });
      }
      const bumped = await tx.ticket.updateMany({ where: { id: ticket.id, version: ticket.version, currentStatus: ticket.currentStatus }, data: { version: { increment: 1 } } });
      if (!bumped.count) staleTicket();
      const updated = await tx.actionTaken.updateMany({ where: { id: action.id, ticketId: ticket.id, version: action.version, status: action.status }, data: { ...data, version: { increment: 1 } } });
      if (!updated.count) staleAction();
      await appendEvents(tx, ticket.id, action.id, actorId, eventType, action.version + 1, ticket.version + 1, diff);
      const fresh = await tx.actionTaken.findUniqueOrThrow({ where: { id: action.id }, include: actionInclude });
      return { data: actionView(fresh, ticket.version + 1, false) };
    });
    res.status(200).json(response);
  }

  app.patch("/api/tickets/:ticketId/actions/:actionId", (req, res) => run(req, res, true, true, (session) => mutate(req, res, "edit", session)));
  app.patch("/api/tickets/:ticketId/actions/:actionId/assignee", (req, res) => run(req, res, true, true, (session) => mutate(req, res, "assignee", session)));
  app.patch("/api/tickets/:ticketId/actions/:actionId/status", (req, res) => run(req, res, true, true, (session) => mutate(req, res, "status", session)));
}
