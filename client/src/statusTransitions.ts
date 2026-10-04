import type { TicketStatus } from "./api.js";

export interface StatusOption { to: TicketStatus; ownerRequired: boolean; confirm: boolean }

type Row = [TicketStatus, TicketStatus, boolean, boolean];

// Mirrors server/src/status-transitions.ts; the backend remains the authority.
const ROWS: Row[] = [
  ["NEW", "OPEN", false, false], ["NEW", "CANCELLED", false, true],
  ["OPEN", "IN_PROGRESS", true, false], ["OPEN", "WAITING_FOR_REQUESTER", true, false], ["OPEN", "CANCELLED", false, true],
  ["IN_PROGRESS", "WAITING_FOR_REQUESTER", true, false], ["IN_PROGRESS", "RESOLVED", true, true], ["IN_PROGRESS", "CANCELLED", true, true],
  ["WAITING_FOR_REQUESTER", "IN_PROGRESS", true, false], ["WAITING_FOR_REQUESTER", "RESOLVED", true, true], ["WAITING_FOR_REQUESTER", "CANCELLED", true, true],
  ["RESOLVED", "CLOSED", true, true], ["RESOLVED", "REOPENED", false, true], ["CLOSED", "REOPENED", false, true], ["CANCELLED", "REOPENED", false, true],
  ["REOPENED", "IN_PROGRESS", true, false], ["REOPENED", "WAITING_FOR_REQUESTER", true, false], ["REOPENED", "RESOLVED", true, true], ["REOPENED", "CANCELLED", true, true],
];

export function nextStatuses(from: TicketStatus): StatusOption[] {
  return ROWS.filter((row) => row[0] === from).map(([, to, ownerRequired, confirm]) => ({ to, ownerRequired, confirm }));
}
