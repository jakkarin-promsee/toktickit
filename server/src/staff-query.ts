import { positiveInteger, singleValue } from "./ticket-query.js";

export const STAFF_SORT_FIELDS = ["updatedAt", "createdAt", "ticketNumber", "requestedPriority", "itPriority", "status"] as const;
export const STAFF_PAGE_SIZES = [10, 20, 50] as const;
export const TICKET_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type StaffSortField = (typeof STAFF_SORT_FIELDS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

export interface StaffQuery {
  view?: "unassigned" | "owned-by-me" | "my-active-actions" | "recent-updated" | "urgent";
  from?: Date;
  through?: Date;
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
  const allowed = new Set(["search", "categoryId", "relatedSystemId", "status", "requestedPriority", "itPriority", "owner", "sortBy", "sortOrder", "page", "pageSize", "view", "from", "through"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Unknown query parameter ${key}.`);
  }
  const search = singleValue(input.search, "search")?.trim() ?? "";
  if (Array.from(search).length > 120) throw new Error("Invalid search.");

  const ownerRaw = singleValue(input.owner, "owner");
  const view = singleValue(input.view, "view");
  if (view !== undefined && !["unassigned", "owned-by-me", "my-active-actions", "recent-updated", "urgent"].includes(view)) throw new Error("Invalid view.");
  const fromRaw = singleValue(input.from, "from");
  const throughRaw = singleValue(input.through, "through");
  if (view && (ownerRaw !== undefined || input.status !== undefined || input.requestedPriority !== undefined || input.itPriority !== undefined)) throw new Error("Incompatible view filters.");
  if ((view === "recent-updated") !== Boolean(fromRaw && throughRaw) || (view !== "recent-updated" && (fromRaw !== undefined || throughRaw !== undefined))) throw new Error("Invalid date filters.");
  const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
  if (fromRaw && throughRaw && (!iso.test(fromRaw) || !iso.test(throughRaw) || !Number.isFinite(Date.parse(fromRaw)) || !Number.isFinite(Date.parse(throughRaw)) || Date.parse(fromRaw) > Date.parse(throughRaw))) throw new Error("Invalid date filters.");
  const owner = ownerRaw === undefined ? undefined : ownerRaw === "me" || ownerRaw === "unassigned" ? ownerRaw : positiveInteger(ownerRaw, "owner");

  const rawPageSize = singleValue(input.pageSize, "pageSize");
  const pageSize = rawPageSize === undefined ? 20 : /^\d+$/.test(rawPageSize) ? Number(rawPageSize) : NaN;
  if (!(STAFF_PAGE_SIZES as readonly number[]).includes(pageSize)) throw new Error("Invalid pageSize.");

  return {
    view: view as StaffQuery["view"],
    from: fromRaw ? new Date(fromRaw) : undefined,
    through: throughRaw ? new Date(throughRaw) : undefined,
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
