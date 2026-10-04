import { FormEvent, MouseEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  attachmentDownloadUrl,
  Category,
  createTicket,
  getCategories,
  getRelatedSystems,
  RelatedSystem,
  RequestedPriority,
  CurrentUser,
  fetchTicketDetail,
  getMyTickets,
  getTicketComments,
  markProblemAppearsResolved,
  postTicketComment,
  PublicComment,
  TicketDetail,
  TicketListItem,
  TicketStatus,
} from "./api.js";

const MAX_COMMENT = 2000;

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className="badge badge-zen">{STATUS_LABELS[status]}</span>;
}

export function MyTickets({ onOpen }: { onOpen: (event: MouseEvent<HTMLAnchorElement>, ticketId: string) => void }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const load = useCallback(() => {
    setState("loading");
    getMyTickets().then((result) => { setTickets(result.data); setState("ready"); }).catch(() => setState("failed"));
  }, []);
  useEffect(load, [load]);
  return (
    <section aria-labelledby="my-tickets-heading">
      <h1 id="my-tickets-heading">My Tickets</h1>
      {state === "loading" && <p role="status">Loading tickets…</p>}
      {state === "failed" && <div className="alert alert-danger" role="alert">Tickets could not be loaded. <button className="btn btn-sm btn-outline-secondary" onClick={load}>Retry</button></div>}
      {state === "ready" && tickets.length === 0 && <p>You have not submitted any tickets yet.</p>}
      {state === "ready" && tickets.length > 0 && (
        <ul className="list-unstyled">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="card zen-card p-3 mb-2">
              <a href={`/tickets/${ticket.id}`} onClick={(event) => onOpen(event, ticket.id)}>{ticket.ticketNumber} · {ticket.summary}</a>
              <div className="mt-1"><StatusBadge status={ticket.currentStatus} /> <span className="badge badge-priority">Requested: {PRIORITY_LABELS[ticket.requestedPriority]}</span></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RequesterTicketDetail({ ticketId, user, onBack }: { ticketId: string; user: CurrentUser; onBack: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const [state, setState] = useState<"loading" | "ready" | "notFound" | "failed">("loading");
  const [loadError, setLoadError] = useState("");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [posting, setPosting] = useState(false);
  const [postFailure, setPostFailure] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveFailure, setResolveFailure] = useState("");

  const load = useCallback(() => {
    setState("loading");
    setLoadError("");
    Promise.all([fetchTicketDetail(ticketId), getTicketComments(ticketId)])
      .then(([detail, list]) => { setTicket(detail); setComments(list); setState("ready"); })
      .catch((error: unknown) => {
        const apiError = error as ApiError;
        if (apiError.status === 404) setState("notFound");
        else { setLoadError(apiError.message || "Ticket could not be loaded."); setState("failed"); }
      });
  }, [ticketId]);
  useEffect(load, [load]);

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (posting) return;
    const content = draft.trim();
    const length = Array.from(content).length;
    setPostFailure(""); setPostSuccess("");
    if (length === 0) { setDraftError("Comment is required."); return; }
    if (length > MAX_COMMENT) { setDraftError(`Comment must contain ${MAX_COMMENT} characters or fewer.`); return; }
    setDraftError(""); setPosting(true);
    try {
      const created = await postTicketComment(ticketId, content, user.csrfToken);
      setComments((current) => [...current, created]);
      setDraft(""); setPostSuccess("Comment posted.");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.fields?.content) setDraftError(apiError.fields.content);
      else setPostFailure(apiError.message || "Comment could not be posted. Please try again.");
    } finally { setPosting(false); }
  }

  async function confirmResolved() {
    if (!ticket || resolving) return;
    setResolving(true); setResolveFailure("");
    try {
      setTicket(await markProblemAppearsResolved(ticket.id, ticket.version, user.csrfToken));
      setConfirming(false);
    } catch (error) {
      setResolveFailure((error as ApiError).message || "The request could not be recorded. Please try again.");
      setConfirming(false);
    } finally { setResolving(false); }
  }

  if (state === "loading") return <p role="status">Loading ticket…</p>;
  if (state === "notFound") return <><p role="alert">We couldn't find this ticket.</p><a href="/tickets" onClick={onBack}>Back to My Tickets</a></>;
  if (state === "failed" || !ticket) return <div className="alert alert-danger" role="alert">{loadError} <button className="btn btn-sm btn-outline-secondary" onClick={load}>Retry</button></div>;

  const canSignal = ticket.currentStatus === "WAITING_FOR_REQUESTER" && !ticket.requesterResolvedAt;
  return (
    <article className="requester-detail">
      <a href="/tickets" onClick={onBack}>Back to My Tickets</a>
      <h1 className="mt-2">{ticket.summary}</h1>
      <section className="card zen-card p-3 mb-3" aria-label="Ticket information">
        <dl className="mb-0">
          <dt>Ticket Number</dt><dd>{ticket.ticketNumber}</dd>
          <dt>Status</dt><dd><StatusBadge status={ticket.currentStatus} /></dd>
          <dt>Category</dt><dd>{ticket.category.name}</dd>
          <dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd>
          <dt>Requested Priority</dt><dd>{PRIORITY_LABELS[ticket.requestedPriority]}</dd>
          <dt>Description</dt><dd className="comment-text">{ticket.description}</dd>
        </dl>
      </section>

      <section className="card zen-card p-3 mb-3" aria-label="Attachments">
        <h2 className="h5">Attachments</h2>
        {ticket.attachments.length === 0 ? <p className="mb-0">No attachments.</p> : (
          <ul className="mb-0">
            {ticket.attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.state === "ACTIVE" ? <a href={attachmentDownloadUrl(attachment.id)}>{attachment.originalName}</a> : <span>{attachment.originalName} (removed)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ticket.requesterResolvedAt && <p className="alert alert-success" role="status">You indicated the problem appears resolved on {formatTime(ticket.requesterResolvedAt)}. Support will review and resolve or close the Ticket.</p>}
      {canSignal && (
        <section className="card zen-card p-3 mb-3" aria-label="Problem appears resolved">
          <h2 className="h5">Problem appears resolved</h2>
          <p>This tells support that the issue seems fixed; support must still resolve or close the Ticket.</p>
          {resolveFailure && <div className="alert alert-danger" role="alert">{resolveFailure}</div>}
          <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={resolving}>Problem appears resolved</button>
        </section>
      )}
      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-resolved-title" className="card zen-card p-3 mb-3">
          <h2 id="confirm-resolved-title" className="h5">Confirm</h2>
          <p>Tell support the problem on {ticket.ticketNumber} appears resolved? Support must still resolve or close the Ticket.</p>
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={() => void confirmResolved()} disabled={resolving}>{resolving ? "Saving…" : "Confirm"}</button>
            <button className="btn btn-outline-secondary" onClick={() => setConfirming(false)} disabled={resolving}>Cancel</button>
          </div>
        </div>
      )}

      <section className="card zen-card p-3" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="h5">Public Comments</h2>
        {comments.length === 0 ? <p>No comments yet.</p> : (
          <ul className="list-unstyled">
            {comments.map((comment) => (
              <li key={comment.id} className="mb-3">
                <strong>{comment.author.displayName}</strong> <time dateTime={comment.createdAt}>{formatTime(comment.createdAt)}</time>
                <div className="comment-text">{comment.content}</div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(event) => void submitComment(event)} noValidate>
          <label htmlFor="new-comment" className="form-label">Add public comment</label>
          <textarea id="new-comment" className={`form-control${draftError ? " is-invalid" : ""}`} rows={4} value={draft} disabled={posting} aria-describedby="comment-help comment-error" aria-invalid={Boolean(draftError)} onChange={(event) => { setDraft(event.target.value); setDraftError(""); }} />
          <div id="comment-help" className="form-text">Visible to you and support staff · {Array.from(draft).length}/{MAX_COMMENT}</div>
          {draftError && <div id="comment-error" className="invalid-feedback d-block">{draftError}</div>}
          {postFailure && <div className="alert alert-danger mt-2" role="alert">{postFailure}</div>}
          {postSuccess && <div className="alert alert-success mt-2" role="status">{postSuccess}</div>}
          <button type="submit" className="btn btn-primary mt-2" disabled={posting}>{posting ? "Posting…" : "Post comment"}</button>
        </form>
      </section>
    </article>
  );
}

export function CreateTicket({ user, onCreated }: { user: CurrentUser; onCreated: (ticketId: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [form, setForm] = useState({ categoryId: "", relatedSystemId: "", summary: "", requestedPriority: "MEDIUM", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoadState("loading");
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([cats, syss]) => { setCategories(cats); setSystems(syss); setLoadState("ready"); })
      .catch(() => setLoadState("failed"));
  }, []);
  useEffect(load, [load]);

  function set(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    const summary = form.summary.trim();
    const description = form.description.trim();
    if (!form.categoryId) next.categoryId = "Select a category.";
    if (!form.relatedSystemId) next.relatedSystemId = "Select a related system.";
    if (Array.from(summary).length < 5 || Array.from(summary).length > 120) next.summary = "Summary must contain 5–120 characters.";
    if (Array.from(description).length < 10 || Array.from(description).length > 2000) next.description = "Description must contain 10–2,000 characters.";
    setErrors(next); setFailure("");
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const created = await createTicket({ categoryId: Number(form.categoryId), relatedSystemId: Number(form.relatedSystemId), summary, requestedPriority: form.requestedPriority as RequestedPriority, description }, user.csrfToken);
      onCreated(created.id);
    } catch (error) {
      const failed = error as Error & { fields?: Record<string, string> };
      if (failed.fields) setErrors(failed.fields);
      setFailure(failed.message || "Ticket could not be created. Please try again.");
      setBusy(false);
    }
  }

  if (loadState === "loading") return <p role="status">Loading form…</p>;
  if (loadState === "failed") return <div className="alert alert-danger" role="alert">The form could not be loaded. <button className="btn btn-sm btn-outline-secondary" onClick={load}>Retry</button></div>;
  const field = (name: string) => ({ className: `form-control${errors[name] ? " is-invalid" : ""}`, "aria-invalid": Boolean(errors[name]), disabled: busy });
  const error = (name: string) => errors[name] ? <div className="invalid-feedback d-block">{errors[name]}</div> : null;
  return (
    <section aria-labelledby="create-ticket-heading">
      <h1 id="create-ticket-heading">Create Ticket</h1>
      <form className="card zen-card p-3" onSubmit={(event) => void submit(event)} noValidate>
        <div className="mb-3"><label htmlFor="category" className="form-label">Category</label>
          <select id="category" {...field("categoryId")} value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)}><option value="">Select…</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{error("categoryId")}</div>
        <div className="mb-3"><label htmlFor="related-system" className="form-label">Related System</label>
          <select id="related-system" {...field("relatedSystemId")} value={form.relatedSystemId} onChange={(event) => set("relatedSystemId", event.target.value)}><option value="">Select…</option>{systems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{error("relatedSystemId")}</div>
        <div className="mb-3"><label htmlFor="summary" className="form-label">Summary</label>
          <input id="summary" {...field("summary")} value={form.summary} onChange={(event) => set("summary", event.target.value)} />{error("summary")}</div>
        <div className="mb-3"><label htmlFor="priority" className="form-label">Requested Priority</label>
          <select id="priority" {...field("requestedPriority")} value={form.requestedPriority} onChange={(event) => set("requestedPriority", event.target.value)}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></div>
        <div className="mb-3"><label htmlFor="description" className="form-label">Description</label>
          <textarea id="description" rows={5} {...field("description")} value={form.description} onChange={(event) => set("description", event.target.value)} />{error("description")}</div>
        {failure && <div className="alert alert-danger" role="alert">{failure}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit ticket"}</button>
      </form>
    </section>
  );
}
