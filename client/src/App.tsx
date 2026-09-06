import { useEffect, useState } from "react";
import {
  checkSystem,
  DevelopmentRequester,
  getDevelopmentRequesters,
} from "./api.js";

type RequesterState = "loading" | "ready" | "empty" | "error";
type DiagnosticsState = "idle" | "loading" | "success" | "error";

const OFFLINE_MESSAGE = "Unable to connect to TokTickIT API";
const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

export default function App() {
  const [requesterState, setRequesterState] =
    useState<RequesterState>("loading");
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [selectedRequester, setSelectedRequester] =
    useState<DevelopmentRequester | null>(null);
  const [selection, setSelection] = useState("");
  const [requesterError, setRequesterError] = useState("");
  const [diagnosticsState, setDiagnosticsState] =
    useState<DiagnosticsState>("idle");
  const [diagnosticCategories, setDiagnosticCategories] = useState<
    { id: number; name: string }[]
  >([]);
  const [diagnosticError, setDiagnosticError] = useState("");

  async function loadRequesters() {
    setRequesterState("loading");
    setRequesterError("");

    try {
      const loaded = await getDevelopmentRequesters();
      setRequesters(loaded);
      if (loaded.length === 0) {
        setSelectedRequester(null);
        setRequesterState("empty");
        return;
      }

      const savedId = localStorage.getItem(REQUESTER_STORAGE_KEY);
      const saved = loaded.find((requester) => String(requester.id) === savedId);
      if (saved) {
        setSelectedRequester(saved);
        setSelection(String(saved.id));
      } else {
        localStorage.removeItem(REQUESTER_STORAGE_KEY);
        setSelectedRequester(null);
      }
      setRequesterState("ready");
    } catch {
      setRequesters([]);
      setSelectedRequester(null);
      setRequesterState("error");
      setRequesterError("We couldn't load Requesters. Please try again.");
    }
  }

  useEffect(() => {
    void loadRequesters();
  }, []);

  function clearRequesterState() {
    const requesterKeys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index),
    );
    for (const key of requesterKeys) {
      if (key?.startsWith("toktickit.requester.")) {
        sessionStorage.removeItem(key);
      }
    }
  }

  function continueWithRequester() {
    const requester = requesters.find(
      (item) => String(item.id) === selection,
    );
    if (!requester) return;

    clearRequesterState();
    localStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
    setSelectedRequester(requester);
  }

  function changeRequester() {
    clearRequesterState();
    localStorage.removeItem(REQUESTER_STORAGE_KEY);
    setSelectedRequester(null);
    setSelection("");
  }

  async function handleCheck() {
    setDiagnosticsState("loading");
    setDiagnosticError("");

    try {
      const status = await checkSystem();
      setDiagnosticCategories(status.categories);
      setDiagnosticsState("success");
    } catch (error) {
      setDiagnosticCategories([]);
      setDiagnosticError(error instanceof Error ? error.message : String(error));
      setDiagnosticsState("error");
    }
  }

  if (selectedRequester) {
    return (
      <div className="min-vh-100 bg-light">
        <header className="navbar navbar-dark bg-success px-3" role="banner">
          <span className="navbar-brand">TokTickIT</span>
          <span className="text-white">
            Development Requester: <strong>{selectedRequester.displayName}</strong>
          </span>
          <button className="btn btn-outline-light ms-auto" onClick={changeRequester}>
            Change Requester
          </button>
        </header>
        <nav className="navbar navbar-expand bg-white border-bottom px-3" aria-label="Main navigation">
          <a className="nav-link active" aria-current="page" href="#my-tickets">
            My Tickets
          </a>
          <a className="nav-link" href="#create-ticket">
            Create Ticket
          </a>
        </nav>
        <main className="container py-4">
          <h1>My Tickets</h1>
          <p className="text-body-secondary">
            Ticket screens will use the selected Development Requester context.
          </p>
        </main>
      </div>
    );
  }

  return (
    <main className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">TokTickIT</h1>
      <section className="card shadow-sm p-4" aria-labelledby="requester-heading">
        <h2 id="requester-heading" className="h4">
          Select a Development Requester
        </h2>
        <p>
          Select a Development Requester to test requester-specific ticket
          behavior. This is not a login screen. Authentication and role-based
          access will be introduced in Lab 3.
        </p>

        {requesterState === "loading" && (
          <p role="status">Loading active Requesters…</p>
        )}
        {requesterState === "error" && (
          <div className="alert alert-danger" role="alert">
            <p>{requesterError}</p>
            <button className="btn btn-outline-danger" onClick={() => void loadRequesters()}>
              Retry
            </button>
          </div>
        )}
        {requesterState === "empty" && (
          <div className="alert alert-warning" role="alert">
            <p>No active Development Requesters are available.</p>
            <button className="btn btn-outline-secondary" onClick={() => void loadRequesters()}>
              Retry
            </button>
          </div>
        )}
        {(requesterState === "ready" || requesters.length > 0) && (
          <>
            <label className="form-label" htmlFor="development-requester">
              Development Requester
            </label>
            <select
              id="development-requester"
              className="form-select"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              disabled={requesterState !== "ready"}
            >
              <option value="">Choose a Requester</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.displayName}
                </option>
              ))}
            </select>
            <button
              className="btn btn-success mt-3"
              onClick={continueWithRequester}
              disabled={!selection || requesterState !== "ready"}
            >
              Continue
            </button>
          </>
        )}
      </section>

      <section className="mt-4" aria-label="System diagnostics">
        <button className="btn btn-secondary" onClick={handleCheck} disabled={diagnosticsState === "loading"}>
          {diagnosticsState === "loading" ? "Loading…" : "Check System"}
        </button>
        {diagnosticsState === "loading" && (
          <p className="mt-3" role="status">⏳ Loading…</p>
        )}
        {diagnosticsState === "success" && (
          <>
            <p className="mt-3">System Status: <span className="badge bg-success">Online</span></p>
            <h2 className="h5">Supported Request Categories</h2>
            {diagnosticCategories.length > 0 ? (
              <ol className="list-group list-group-numbered">
                {diagnosticCategories.map((category) => (
                  <li key={category.id} className="list-group-item">{category.name}</li>
                ))}
              </ol>
            ) : (
              <p>The API returned no categories. Has the database been seeded?</p>
            )}
          </>
        )}
        {diagnosticsState === "error" && (
          <div className="alert alert-danger mt-3" role="alert">
            <p className="fw-semibold">System Status: Offline</p>
            <p>{OFFLINE_MESSAGE}</p>
            {diagnosticError && <p className="small">Details: {diagnosticError}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
