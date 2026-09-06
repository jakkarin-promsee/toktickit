export const TICKET_SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "ticketNumber",
  "summary",
] as const;

export const TICKET_PAGE_SIZES = [10, 20, 50] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];
export type TicketSortOrder = "asc" | "desc";

export interface TicketQuery {
  search: string;
  categoryId?: number;
  relatedSystemId?: number;
  status?: "NEW";
  requestedPriority?: "LOW" | "MEDIUM" | "HIGH";
  sortBy: TicketSortField;
  sortOrder: TicketSortOrder;
  page: number;
  pageSize: (typeof TICKET_PAGE_SIZES)[number];
}

function singleValue(input: unknown, key: string): string | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input) || typeof input !== "string") {
    throw new Error(`Invalid ${key}.`);
  }
  return input;
}

function positiveInteger(value: string | undefined, key: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`Invalid ${key}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${key}.`);
  return parsed;
}

export function parseTicketQuery(input: Record<string, unknown>): TicketQuery {
  const allowed = new Set([
    "search",
    "categoryId",
    "relatedSystemId",
    "status",
    "requestedPriority",
    "sortBy",
    "sortOrder",
    "page",
    "pageSize",
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Unknown query parameter ${key}.`);
  }

  const search = singleValue(input.search, "search")?.trim() ?? "";
  if (Array.from(search).length > 120) throw new Error("Invalid search.");

  const categoryId = positiveInteger(
    singleValue(input.categoryId, "categoryId"),
    "categoryId",
  );
  const relatedSystemId = positiveInteger(
    singleValue(input.relatedSystemId, "relatedSystemId"),
    "relatedSystemId",
  );
  const status = singleValue(input.status, "status");
  if (status !== undefined && status !== "NEW") throw new Error("Invalid status.");

  const requestedPriority = singleValue(
    input.requestedPriority,
    "requestedPriority",
  );
  if (
    requestedPriority !== undefined &&
    !["LOW", "MEDIUM", "HIGH"].includes(requestedPriority)
  ) {
    throw new Error("Invalid requestedPriority.");
  }

  const sortBy = singleValue(input.sortBy, "sortBy") ?? "updatedAt";
  if (!(TICKET_SORT_FIELDS as readonly string[]).includes(sortBy)) {
    throw new Error("Invalid sortBy.");
  }
  const sortOrder = singleValue(input.sortOrder, "sortOrder") ?? "desc";
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    throw new Error("Invalid sortOrder.");
  }

  const page = positiveInteger(singleValue(input.page, "page"), "page") ?? 1;
  const rawPageSize = singleValue(input.pageSize, "pageSize");
  const pageSize = rawPageSize === undefined ? 10 : Number(rawPageSize);
  if (!TICKET_PAGE_SIZES.includes(pageSize as (typeof TICKET_PAGE_SIZES)[number])) {
    throw new Error("Invalid pageSize.");
  }

  return {
    search,
    categoryId,
    relatedSystemId,
    status: status as "NEW" | undefined,
    requestedPriority: requestedPriority as TicketQuery["requestedPriority"],
    sortBy: sortBy as TicketSortField,
    sortOrder: sortOrder as TicketSortOrder,
    page,
    pageSize: pageSize as TicketQuery["pageSize"],
  };
}
