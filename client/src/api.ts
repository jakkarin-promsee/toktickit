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

export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; displayName: string };
  category: Category;
  relatedSystem: RelatedSystem;
  summary: string;
  requestedPriority: RequestedPriority;
  itPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus: TicketStatus;
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
  currentStatus: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAttachmentMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  state: "ACTIVE" | "REMOVED";
  uploadedByDisplayName: string;
  createdAt: string;
  removedAt: string | null;
  removedByDisplayName: string | null;
  removalReason: string | null;
}

export interface TicketDetail extends CreatedTicket {
  attachments: TicketAttachmentMetadata[];
  requesterResolvedAt: string | null;
  version: number;
}

export interface PublicComment {
  id: string;
  content: string;
  author: { id: number; displayName: string };
  createdAt: string;
}

export async function uploadAttachment(
  ticketId: string,
  file: File,
  csrfToken: string,
): Promise<TicketAttachmentMetadata> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken },
    body: form,
  });
  const payload = (await response.json()) as {
    data?: TicketAttachmentMetadata;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    const error = new Error(payload.error?.message ?? "Attachment could not be uploaded.") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export async function removeAttachment(
  attachmentId: string,
  reason: string,
  csrfToken: string,
): Promise<TicketAttachmentMetadata> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Origin: window.location.origin,
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify({ reason }),
  });
  const payload = (await response.json()) as {
    data?: TicketAttachmentMetadata;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Attachment could not be removed.");
  }
  return payload.data;
}

export function attachmentDownloadUrl(attachmentId: string, inline = false): string {
  return `${API_URL}/api/attachments/${attachmentId}/download${inline ? "?disposition=inline" : ""}`;
}

export async function downloadAttachment(
  attachmentId: string,
  inline = false,
): Promise<Blob> {
  const response = await fetch(attachmentDownloadUrl(attachmentId, inline), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Attachment could not be downloaded.");
  }
  return response.blob();
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
  query: TicketListQuery = {},
): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const queryString = params.toString();
  const response = await fetch(
    `${API_URL}/api/tickets${queryString ? `?${queryString}` : ""}`,
    { credentials: "include" },
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

export async function getTicketDetail(
  ticketId: string,
): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    credentials: "include",
  });
  const payload = (await response.json()) as {
    data?: TicketDetail;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    const error = new Error(
      response.status === 404
        ? "We couldn't find this ticket."
        : payload.error?.message ?? "Ticket could not be loaded.",
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export async function createTicket(
  input: {
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    requestedPriority: RequestedPriority;
    description: string;
  },
  csrfToken: string,
): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: window.location.origin,
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
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

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface CurrentUser {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: true;
  mustChangePassword: boolean;
  sessionExpiresAt: string;
  csrfToken: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  retryAfter?: string | null;

  constructor(status: number, payload: { error?: { code?: string; message?: string; fields?: Record<string, string> } }, retryAfter?: string | null) {
    super(payload.error?.message ?? "The request could not be completed.");
    this.status = status;
    this.code = payload.error?.code;
    this.fields = payload.error?.fields;
    this.retryAfter = retryAfter;
  }
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const payload = response.status === 204 ? {} : await response.json() as { data?: T; error?: { code?: string; message?: string; fields?: Record<string, string> } };
  if (!response.ok || (response.status !== 204 && !payload.data)) throw new ApiError(response.status, payload, response.headers.get("Retry-After"));
  return payload.data as T;
}

export function getCurrentUser(): Promise<CurrentUser> { return authRequest<CurrentUser>("/api/auth/me"); }

export function login(email: string, password: string): Promise<CurrentUser> {
  return authRequest<CurrentUser>("/api/auth/login", { method: "POST", headers: { Origin: window.location.origin }, body: JSON.stringify({ email, password }) });
}

export function changePassword(currentPassword: string, newPassword: string, csrfToken: string): Promise<CurrentUser> {
  return authRequest<CurrentUser>("/api/auth/change-password", { method: "POST", headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken }, body: JSON.stringify({ currentPassword, newPassword }) });
}

export function logout(csrfToken: string): Promise<void> {
  return authRequest<void>("/api/auth/logout", { method: "POST", headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken } });
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Category).id === "number" &&
    typeof (value as Category).name === "string"
  );
}

export function getTicketComments(ticketId: string): Promise<PublicComment[]> {
  return authRequest<PublicComment[]>(`/api/tickets/${ticketId}/comments`);
}

export function postTicketComment(ticketId: string, content: string, csrfToken: string): Promise<PublicComment> {
  return authRequest<PublicComment>(`/api/tickets/${ticketId}/comments`, { method: "POST", headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken }, body: JSON.stringify({ content }) });
}

export function markProblemAppearsResolved(ticketId: string, version: number, csrfToken: string): Promise<TicketDetail> {
  return authRequest<TicketDetail>(`/api/tickets/${ticketId}/problem-appears-resolved`, { method: "POST", headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken }, body: JSON.stringify({ version }) });
}

export function fetchTicketDetail(ticketId: string): Promise<TicketDetail> {
  return authRequest<TicketDetail>(`/api/tickets/${ticketId}`);
}

export interface StaffQueueTicket {
  id: string;
  ticketNumber: string;
  summary: string;
  requester: { id: number; displayName: string };
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  owner: { id: number; displayName: string; role: UserRole } | null;
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StaffQueueResponse {
  data: StaffQueueTicket[];
  pagination: TicketListResponse["pagination"];
  counts: { total: number; unassigned: number; mine: number };
}

export async function getStaffQueue(search: string): Promise<StaffQueueResponse> {
  const response = await fetch(`${API_URL}/api/staff/tickets${search}`, { credentials: "include" });
  const payload = await response.json() as Partial<StaffQueueResponse> & { error?: { code?: string; message?: string } };
  if (!response.ok || !payload.data || !payload.pagination || !payload.counts) throw new ApiError(response.status, payload);
  return payload as StaffQueueResponse;
}

export interface PersonRef { id: number; displayName: string; role?: UserRole }

export interface StaffTicketDetail {
  id: string;
  ticketNumber: string;
  summary: string;
  description: string;
  requester: PersonRef;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  owner: PersonRef | null;
  requesterResolvedAt: string | null;
  requesterResolvedBy: PersonRef | null;
  lastStatusChangedAt: string | null;
  lastStatusChangedBy: PersonRef | null;
  lastOwnerChangedAt: string | null;
  lastOwnerChangedBy: PersonRef | null;
  lastPriorityChangedAt: string | null;
  lastPriorityChangedBy: PersonRef | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  attachments: TicketAttachmentMetadata[];
  publicComments?: PublicComment[];
  internalNotes?: PublicComment[];
}

export function getStaffTicketDetail(ticketId: string): Promise<StaffTicketDetail> {
  return authRequest<StaffTicketDetail>(`/api/staff/tickets/${ticketId}`);
}

export function getAssignees(): Promise<PersonRef[]> {
  return authRequest<PersonRef[]>("/api/staff/assignees");
}

export function staffMutation(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, csrfToken: string): Promise<StaffTicketDetail> {
  return authRequest<StaffTicketDetail>(`/api/staff/tickets/${path}`, { method, headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken }, body: JSON.stringify(body) });
}

export function postInternalNote(ticketId: string, content: string, csrfToken: string): Promise<PublicComment> {
  return authRequest<PublicComment>(`/api/staff/tickets/${ticketId}/internal-notes`, { method: "POST", headers: { Origin: window.location.origin, "X-CSRF-Token": csrfToken }, body: JSON.stringify({ content }) });
}

export interface UserSummary {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

function adminHeaders(csrfToken: string) {
  return { Origin: window.location.origin, "X-CSRF-Token": csrfToken };
}

export function listUsers(search: string, role: string): Promise<UserSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (role) params.set("role", role);
  const text = params.toString();
  return authRequest<UserSummary[]>(`/api/admin/users${text ? `?${text}` : ""}`);
}

export function createUser(input: { displayName: string; email: string; role: UserRole; isActive: boolean; initialPassword: string }, csrfToken: string): Promise<UserSummary> {
  return authRequest<UserSummary>("/api/admin/users", { method: "POST", headers: adminHeaders(csrfToken), body: JSON.stringify(input) });
}

export function updateUser(id: number, input: { displayName: string; email: string; role: UserRole; isActive: boolean; version: number }, csrfToken: string): Promise<UserSummary> {
  return authRequest<UserSummary>(`/api/admin/users/${id}`, { method: "PATCH", headers: adminHeaders(csrfToken), body: JSON.stringify(input) });
}

export function setInitialPassword(id: number, initialPassword: string, csrfToken: string): Promise<void> {
  return authRequest<void>(`/api/admin/users/${id}/initial-password`, { method: "POST", headers: adminHeaders(csrfToken), body: JSON.stringify({ initialPassword }) });
}
