import type { TicketStatusValue } from "./staff-query.js";

export interface TransitionRule {
  ownerRequired: boolean;
  confirmationRequired: boolean;
  clearsRequesterSignal: boolean;
}

type Row = [TicketStatusValue, TicketStatusValue, boolean, boolean, boolean];

// from, to, owner required, confirmation required, clears requester-resolution signal
// Mirrors the "Ticket status-transition matrix" in docs/lab-03/specification.md.
const ROWS: Row[] = [
  ["NEW", "OPEN", false, false, false],
  ["NEW", "CANCELLED", false, true, false],
  ["OPEN", "IN_PROGRESS", true, false, false],
  ["OPEN", "WAITING_FOR_REQUESTER", true, false, true],
  ["OPEN", "CANCELLED", false, true, false],
  ["IN_PROGRESS", "WAITING_FOR_REQUESTER", true, false, true],
  ["IN_PROGRESS", "RESOLVED", true, true, false],
  ["IN_PROGRESS", "CANCELLED", true, true, false],
  ["WAITING_FOR_REQUESTER", "IN_PROGRESS", true, false, true],
  ["WAITING_FOR_REQUESTER", "RESOLVED", true, true, false],
  ["WAITING_FOR_REQUESTER", "CANCELLED", true, true, false],
  ["RESOLVED", "CLOSED", true, true, false],
  ["RESOLVED", "REOPENED", false, true, true],
  ["CLOSED", "REOPENED", false, true, true],
  ["CANCELLED", "REOPENED", false, true, true],
  ["REOPENED", "IN_PROGRESS", true, false, false],
  ["REOPENED", "WAITING_FOR_REQUESTER", true, false, true],
  ["REOPENED", "RESOLVED", true, true, false],
  ["REOPENED", "CANCELLED", true, true, false],
];

const RULES = new Map<string, TransitionRule>(
  ROWS.map(([from, to, ownerRequired, confirmationRequired, clearsRequesterSignal]) => [`${from}>${to}`, { ownerRequired, confirmationRequired, clearsRequesterSignal }]),
);

export function transitionRule(from: TicketStatusValue, to: TicketStatusValue): TransitionRule | undefined {
  return RULES.get(`${from}>${to}`);
}

export function allowedTargets(from: TicketStatusValue): TicketStatusValue[] {
  return ROWS.filter((row) => row[0] === from).map((row) => row[1]);
}
