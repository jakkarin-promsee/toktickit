import { positiveInteger, singleValue } from "./ticket-query.js";

export const STAFF_SORT_FIELDS = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority", "itPriority", "status"] as const;
export const STAFF_PAGE_SIZES = [10, 20, 50] as const;
export const TICKET_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type StaffSortField = (typeof STAFF_SORT_FIELDS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

export interface StaffQuery {
  search: string;
  categoryId?: number;
  relatedSystemId?: number;
  status?: TicketStatusValue;
  requestedPriority?: Priority;
  itPriority?: Priority;
  owner?: "me" | "unassigned" | number;
  sortBy: StaffSortField;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: (typeof STAFF_PAGE_SIZES)[number];
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], key: string): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`Invalid ${key}.`);
  return value as T;
}

export function parseStaffQuery(input: Record<string, unknown>): StaffQuery {
  const allowed = new Set(["search", "categoryId", "relatedSystemId", "status", "requestedPriority", "itPriority", "owner", "sortBy", "sortOrder", "page", "pageSize"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Unknown query parameter ${key}.`);
  }
  const search = singleValue(input.search, "search")?.trim() ?? "";
  if (Array.from(search).length > 120) throw new Error("Invalid search.");

  const ownerRaw = singleValue(input.owner, "owner");
  const owner = ownerRaw === undefined ? undefined : ownerRaw === "me" || ownerRaw === "unassigned" ? ownerRaw : positiveInteger(ownerRaw, "owner");

  const rawPageSize = singleValue(input.pageSize, "pageSize");
  const pageSize = rawPageSize === undefined ? 20 : /^\d+$/.test(rawPageSize) ? Number(rawPageSize) : NaN;
  if (!(STAFF_PAGE_SIZES as readonly number[]).includes(pageSize)) throw new Error("Invalid pageSize.");

  return {
    search,
    categoryId: positiveInteger(singleValue(input.categoryId, "categoryId"), "categoryId"),
    relatedSystemId: positiveInteger(singleValue(input.relatedSystemId, "relatedSystemId"), "relatedSystemId"),
    status: oneOf(singleValue(input.status, "status"), TICKET_STATUSES, "status"),
    requestedPriority: oneOf(singleValue(input.requestedPriority, "requestedPriority"), PRIORITIES, "requestedPriority"),
    itPriority: oneOf(singleValue(input.itPriority, "itPriority"), PRIORITIES, "itPriority"),
    owner,
    sortBy: oneOf(singleValue(input.sortBy, "sortBy"), STAFF_SORT_FIELDS, "sortBy") ?? "updatedAt",
    sortOrder: oneOf(singleValue(input.sortOrder, "sortOrder"), ["asc", "desc"] as const, "sortOrder") ?? "desc",
    page: positiveInteger(singleValue(input.page, "page"), "page") ?? 1,
    pageSize: pageSize as StaffQuery["pageSize"],
  };
}
