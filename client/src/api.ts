const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
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

function isCategory(value: unknown): value is Category {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Category).id === "number" &&
    typeof (value as Category).name === "string"
  );
}
