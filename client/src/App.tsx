import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// Four states, not a boolean: "never checked" and "checked and failed" are
// different things to show, and the labsheet requires a distinct loading state.
type UiState = "idle" | "loading" | "success" | "error";

const OFFLINE_MESSAGE = "Unable to connect to TokTickIT API";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorDetail, setErrorDetail] = useState("");

  async function handleCheck() {
    setState("loading");
    setErrorDetail("");

    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch (error) {
      // Drop whatever a previous successful check left behind, so a failed
      // re-check can never show stale categories next to an error.
      setCategories([]);
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
        <>
          <p className="mt-4 mb-3">
            System Status: <span className="badge bg-success">Online</span>
          </p>

          <h2 className="h5">Supported Request Categories</h2>

          {/* Straight from the API response — nothing about these four names
              is written into the frontend. An ordered list, because the order
              is part of what GET /api/categories promises. */}
          {categories.length > 0 ? (
            <ol className="list-group list-group-numbered">
              {categories.map((category) => (
                // Keyed by database id, not by array index: the id identifies
                // the row no matter how the list is later sorted or filtered.
                <li key={category.id} className="list-group-item">
                  {category.name}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-body-secondary mb-0">
              The API returned no categories. Has the database been seeded?
            </p>
          )}
        </>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4 mb-0" role="alert">
          <p className="mb-1 fw-semibold">System Status: Offline</p>
          <p className="mb-0">{OFFLINE_MESSAGE}</p>
          {errorDetail && <p className="mb-0 mt-2 small">Details: {errorDetail}</p>}
        </div>
      )}
    </div>
  );
}
