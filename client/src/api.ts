const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; displayName: string };
  category: Category;
  relatedSystem: RelatedSystem;
  summary: string;
  requestedPriority: RequestedPriority;
  itPriority: "UNASSIGNED";
  currentStatus: "NEW";
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListItem {
  id: string;
  ticketNumber: string;
  summary: string;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: RequestedPriority;
  itPriority: "UNASSIGNED" | "LOW" | "MEDIUM" | "HIGH";
  currentStatus: "NEW";
  createdAt: string;
  updatedAt: string;
}

export interface TicketListQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  status?: "NEW";
  requestedPriority?: RequestedPriority;
  sortBy?: "updatedAt" | "createdAt" | "ticketNumber" | "summary";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 20 | 50;
}

export interface TicketListResponse {
  data: TicketListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface DevelopmentRequester {
  id: number;
  displayName: string;
  email: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Shape promised by GET /api/health (labsheet section 10.1).
interface HealthResponse {
  status: string;
  service: string;
}

// Issue 2 + Issue 4 — call the backend.
// Every failure path throws, so the UI only has to handle one error state
// instead of inspecting status codes itself.
export async function checkSystem(): Promise<SystemStatus> {
  // A dead backend rejects here with a TypeError ("Failed to fetch") instead of
  // returning a response, so the caller's catch covers that case too.
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as Partial<HealthResponse>;

  // A 200 alone is not proof of health: the contract is the payload, so an
  // unexpected body has to be treated as an outage rather than as success.
  if (body.status !== "ok" || body.service !== "TokTickIT API") {
    throw new Error("Health check returned an unexpected payload");
  }

  // Only now, with the process confirmed alive, ask for the data itself.
  // Both calls sit inside the caller's single try/catch, which is why a
  // database outage still paints the whole screen Offline even though
  // /api/health answered 200 a moment ago — exactly the failure case the
  // labsheet illustrates in Part 4.
  const categoriesResponse = await fetch(`${API_URL}/api/categories`);

  // The 503 the API returns when PostgreSQL is unreachable lands here.
  if (!categoriesResponse.ok) {
    throw new Error(
      `Category list failed with HTTP ${categoriesResponse.status}`
    );
  }

  const payload: unknown = await categoriesResponse.json();

  // A JSON body that parses is not automatically the body we asked for. The
  // error branch of this same endpoint answers with an object, and a row
  // missing its id would render as a blank list item under a duplicate React
  // key — both are better shown as the error state than half-drawn.
  if (!Array.isArray(payload) || !payload.every(isCategory)) {
    throw new Error("Category list returned an unexpected payload");
  }

  // The assertion is backed by the runtime check above, not by hope:
  // TypeScript cannot narrow an array through `every`, so it has to be said
  // out loud here.
  return { online: true, categories: payload as Category[] };
}

export async function getDevelopmentRequesters(): Promise<
  DevelopmentRequester[]
> {
  const response = await fetch(`${API_URL}/api/requesters`);

  if (!response.ok) {
    throw new Error(`Requester list failed with HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { data?: unknown }).data) ||
    !(payload as { data: unknown[] }).data.every(isRequester)
  ) {
    throw new Error("Requester list returned an unexpected payload");
  }

  return (payload as { data: DevelopmentRequester[] }).data;
}

async function getReferenceItems(path: string): Promise<Category[]> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Reference data failed with HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every(isCategory)) {
    throw new Error("Reference data returned an unexpected payload");
  }
  return payload;
}

export function getCategories(): Promise<Category[]> {
  return getReferenceItems("/api/categories");
}

export function getRelatedSystems(): Promise<RelatedSystem[]> {
  return getReferenceItems("/api/related-systems");
}

export async function getMyTickets(
  requesterId: number,
  query: TicketListQuery = {},
): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const queryString = params.toString();
  const response = await fetch(
    `${API_URL}/api/tickets${queryString ? `?${queryString}` : ""}`,
    { headers: { "X-Requester-Id": String(requesterId) } },
  );
  const payload = (await response.json()) as {
    data?: TicketListItem[];
    pagination?: TicketListResponse["pagination"];
    error?: { message?: string };
  };
  if (!response.ok || !Array.isArray(payload.data) || !payload.pagination) {
    throw new Error(payload.error?.message ?? "Tickets could not be loaded.");
  }
  return { data: payload.data, pagination: payload.pagination };
}

export async function createTicket(
  requesterId: number,
  input: {
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    requestedPriority: RequestedPriority;
    description: string;
  },
): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": String(requesterId),
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as {
    data?: CreatedTicket;
    error?: { message?: string; fields?: Record<string, string> };
  };
  if (!response.ok || !payload.data) {
    const error = new Error(
      payload.error?.message ?? "Ticket could not be created. Please try again.",
    ) as Error & { fields?: Record<string, string> };
    error.fields = payload.error?.fields;
    throw error;
  }
  return payload.data;
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Category).id === "number" &&
    typeof (value as Category).name === "string"
  );
}

function isRequester(value: unknown): value is DevelopmentRequester {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DevelopmentRequester).id === "number" &&
    typeof (value as DevelopmentRequester).displayName === "string" &&
    typeof (value as DevelopmentRequester).email === "string"
  );
}
