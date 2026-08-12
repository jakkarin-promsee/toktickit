import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

// Four states, not a boolean: "never checked" and "checked and failed" are
// different things to show, and the labsheet requires a distinct loading state.
const OFFLINE_MESSAGE = "Unable to connect to TokTickIT API";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorDetail, setErrorDetail] = useState("");
  void categories; // TODO(Issue 4): render this list under the Online status.

  async function handleCheck() {
    setState("loading");
    setErrorDetail("");

    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch (error) {
      // The user always gets the same readable sentence; the underlying cause
      // goes underneath it so a failed check can actually be diagnosed.
      setErrorDetail(error instanceof Error ? error.message : String(error));
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && (
        <p className="mt-4 mb-0 text-body-secondary" role="status">
          ⏳ Loading…
        </p>
      )}

      {state === "success" && (
        <p className="mt-4 mb-0">
          System Status: <span className="badge bg-success">Online</span>
        </p>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4 mb-0" role="alert">
          <p className="mb-1 fw-semibold">System Status: Offline</p>
          <p className="mb-0">{OFFLINE_MESSAGE}</p>
          {errorDetail && <p className="mb-0 mt-2 small">Details: {errorDetail}</p>}
        </div>
      )}

      {/* TODO(Issue 4): render the category list under the Online status. */}
    </div>
  );
}
