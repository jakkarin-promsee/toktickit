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
// TODO(Issue 4): fetch `${API_URL}/api/categories` after the health check and
// return the real list instead of the empty one below.
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

  return { online: true, categories: [] };
}
