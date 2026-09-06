import { FormEvent, useEffect, useState } from "react";
import {
  Category,
  checkSystem,
  createTicket,
  CreatedTicket,
  DevelopmentRequester,
  getCategories,
  getDevelopmentRequesters,
  getRelatedSystems,
  RelatedSystem,
  RequestedPriority,
} from "./api.js";

type RequesterState = "loading" | "ready" | "empty" | "error";
type Page = "my-tickets" | "create-ticket";

const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

function countCharacters(value: string) {
  return Array.from(value).length;
}

export default function App() {
  const [requesterState, setRequesterState] = useState<RequesterState>("loading");
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [selectedRequester, setSelectedRequester] =
    useState<DevelopmentRequester | null>(null);
  const [selection, setSelection] = useState("");
  const [requesterError, setRequesterError] = useState("");
  const [page, setPage] = useState<Page>("my-tickets");
  const [diagnosticsState, setDiagnosticsState] =
    useState<"idle" | "loading" | "success" | "error">("idle");
  const [diagnosticCategories, setDiagnosticCategories] = useState<Category[]>([]);
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
      const saved = loaded.find((item) => String(item.id) === savedId);
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
    const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index),
    );
    for (const key of keys) {
      if (key?.startsWith("toktickit.requester.")) sessionStorage.removeItem(key);
    }
  }

  function continueWithRequester() {
    const requester = requesters.find((item) => String(item.id) === selection);
    if (!requester) return;
    clearRequesterState();
    localStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
    setSelectedRequester(requester);
    setPage("my-tickets");
  }

  function changeRequester() {
    clearRequesterState();
    localStorage.removeItem(REQUESTER_STORAGE_KEY);
    setSelectedRequester(null);
    setSelection("");
    setPage("my-tickets");
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

  if (!selectedRequester) {
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
          <button
            className="btn btn-secondary"
            onClick={() => void handleCheck()}
            disabled={diagnosticsState === "loading"}
          >
            {diagnosticsState === "loading" ? "Loading…" : "Check System"}
          </button>
          {diagnosticsState === "loading" && (
            <p className="mt-3" role="status">⏳ Loading…</p>
          )}
          {diagnosticsState === "success" && (
            <>
              <p className="mt-3">
                System Status: <span className="badge bg-success">Online</span>
              </p>
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
              <p>Unable to connect to TokTickIT API</p>
              {diagnosticError && <p className="small">Details: {diagnosticError}</p>}
            </div>
          )}
        </section>
      </main>
    );
  }

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
        <a
          className={`nav-link ${page === "my-tickets" ? "active" : ""}`}
          aria-current={page === "my-tickets" ? "page" : undefined}
          href="#my-tickets"
          onClick={(event) => {
            event.preventDefault();
            setPage("my-tickets");
          }}
        >
          My Tickets
        </a>
        <a
          className={`nav-link ${page === "create-ticket" ? "active" : ""}`}
          aria-current={page === "create-ticket" ? "page" : undefined}
          href="#create-ticket"
          onClick={(event) => {
            event.preventDefault();
            setPage("create-ticket");
          }}
        >
          Create Ticket
        </a>
      </nav>
      <main className="container py-4">
        {page === "create-ticket" ? (
          <CreateTicketPage requester={selectedRequester} onBack={() => setPage("my-tickets")} />
        ) : (
          <>
            <h1>My Tickets</h1>
            <p className="text-body-secondary">
              Your ticket list will be available here. Create a ticket to get started.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function CreateTicketPage({
  requester,
  onBack,
}: {
  requester: DevelopmentRequester;
  onBack: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [referenceError, setReferenceError] = useState("");
  const [form, setForm] = useState({
    categoryId: "",
    relatedSystemId: "",
    summary: "",
    requestedPriority: "" as RequestedPriority | "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([loadedCategories, loadedSystems]) => {
        if (!active) return;
        setCategories(loadedCategories);
        setSystems(loadedSystems);
      })
      .catch(() => {
        if (active) setReferenceError("We couldn't load ticket options. Please try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.categoryId) next.categoryId = "Category is required.";
    if (!form.relatedSystemId) next.relatedSystemId = "Related System is required.";
    const summaryLength = countCharacters(form.summary.trim());
    if (summaryLength < 5 || summaryLength > 120) {
      next.summary = "Summary must contain 5–120 characters.";
    }
    if (!form.requestedPriority) {
      next.requestedPriority = "Requested Priority is required.";
    }
    const descriptionLength = countCharacters(form.description.trim());
    if (descriptionLength < 10 || descriptionLength > 2_000) {
      next.description = "Description must contain 10–2,000 characters.";
    }
    return next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const ticket = await createTicket(requester.id, {
        categoryId: Number(form.categoryId),
        relatedSystemId: Number(form.relatedSystemId),
        summary: form.summary,
        requestedPriority: form.requestedPriority as RequestedPriority,
        description: form.description,
      });
      setCreatedTicket(ticket);
    } catch (error) {
      const typed = error as Error & { fields?: Record<string, string> };
      setErrors(typed.fields ?? {});
      setSubmitError("We couldn't create the ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdTicket) {
    return (
      <section aria-labelledby="create-ticket-heading">
        <h1 id="create-ticket-heading">Create Ticket</h1>
        <div className="alert alert-success" role="status" tabIndex={-1}>
          Ticket created successfully. Official Ticket Number:{" "}
          <strong>{createdTicket.ticketNumber}</strong>
        </div>
        <button className="btn btn-outline-success me-2" onClick={onBack}>
          Go to My Tickets
        </button>
        <button
          className="btn btn-success"
          onClick={() => {
            setCreatedTicket(null);
            setForm({
              categoryId: "",
              relatedSystemId: "",
              summary: "",
              requestedPriority: "",
              description: "",
            });
          }}
        >
          Create another
        </button>
      </section>
    );
  }

  const fieldError = (field: string) =>
    errors[field] ? (
      <div id={`${field}-error`} className="text-danger" role="alert">
        {errors[field]}
      </div>
    ) : null;

  return (
    <section aria-labelledby="create-ticket-heading">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 id="create-ticket-heading">Create Ticket</h1>
        <button className="btn btn-link" onClick={onBack} disabled={submitting}>
          Back to My Tickets
        </button>
      </div>
      {referenceError && <div className="alert alert-danger" role="alert">{referenceError}</div>}
      {submitError && <div className="alert alert-danger" role="alert">{submitError}</div>}
      <form onSubmit={(event) => void submit(event)} noValidate>
        <section className="card p-4 mb-3" aria-labelledby="ticket-information-heading">
          <h2 id="ticket-information-heading" className="h4">Ticket information</h2>
          <div className="row g-3">
            <ReadOnlyField label="Ticket Number" value="Generated after submission" />
            <ReadOnlyField label="Ticket Date" value="Assigned on submission" />
            <ReadOnlyField label="Requester" value={requester.displayName} />
            <ReadOnlyField label="Current Status" value="New" />
            <ReadOnlyField label="IT Priority" value="Unassigned" />
            <div className="col-md-6">
              <label className="form-label" htmlFor="category">Category *</label>
              <select
                id="category"
                className="form-select"
                required
                value={form.categoryId}
                onChange={(event) => updateField("categoryId", event.target.value)}
                aria-invalid={Boolean(errors.categoryId)}
                aria-describedby={errors.categoryId ? "category-error" : undefined}
              >
                <option value="">Choose a Category</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {fieldError("categoryId")}
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="related-system">Related System *</label>
              <select
                id="related-system"
                className="form-select"
                required
                value={form.relatedSystemId}
                onChange={(event) => updateField("relatedSystemId", event.target.value)}
                aria-invalid={Boolean(errors.relatedSystemId)}
                aria-describedby={errors.relatedSystemId ? "relatedSystemId-error" : undefined}
              >
                <option value="">Choose a Related System</option>
                {systems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {fieldError("relatedSystemId")}
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="ticket-summary">Ticket Summary *</label>
              <input
                id="ticket-summary"
                className="form-control"
                required
                value={form.summary}
                onChange={(event) => updateField("summary", event.target.value)}
                aria-invalid={Boolean(errors.summary)}
                aria-describedby={errors.summary ? "summary-error" : undefined}
              />
              {fieldError("summary")}
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="requested-priority">Requested Priority *</label>
              <select
                id="requested-priority"
                className="form-select"
                required
                value={form.requestedPriority}
                onChange={(event) => updateField("requestedPriority", event.target.value)}
                aria-invalid={Boolean(errors.requestedPriority)}
                aria-describedby={errors.requestedPriority ? "requestedPriority-error" : undefined}
              >
                <option value="">Choose a Priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              {fieldError("requestedPriority")}
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="description">Description *</label>
              <textarea
                id="description"
                className="form-control"
                required
                rows={7}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "description-error" : undefined}
              />
              {fieldError("description")}
            </div>
          </div>
        </section>
        <section className="card p-4 mb-3" aria-labelledby="attachments-heading">
          <h2 id="attachments-heading" className="h4">Attachments</h2>
          <p className="text-body-secondary">
            Attachment transfer will be available in the next feature increment.
            JPG/JPEG, PNG, WEBP, and PDF up to 5 MB each.
          </p>
        </section>
        <button className="btn btn-success" type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Creating ticket…" : "Create Ticket"}
        </button>
      </form>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="col-md-6">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input id={id} className="form-control bg-light" value={value} readOnly aria-readonly="true" />
    </div>
  );
}
