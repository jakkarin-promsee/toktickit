import { FormEvent, MouseEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError, attachmentDownloadUrl, CurrentUser, getAssignees, getStaffTicketDetail, PersonRef, postInternalNote, postTicketComment,
  PublicComment, RequestedPriority, staffMutation, StaffTicketDetail as Detail, TicketStatus,
} from "./api.js";
import { nextStatuses } from "./statusTransitions.js";

const MAX_TEXT = 2000;
const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress", WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};
const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const STALE_MESSAGE = "This Ticket changed. Refresh before trying again.";

type Card = "owner" | "priority" | "status";
type Tab = "public" | "internal" | "attachments";
interface Feedback { card: string; kind: "success" | "error"; text: string; fields?: Record<string, string> }
interface Confirmation { title: string; body: string; run: () => void }

function formatTime(value: string) { return new Date(value).toLocaleString(); }

function Entries({ items, empty }: { items: PublicComment[]; empty: string }) {
  if (items.length === 0) return <p>{empty}</p>;
  return (
    <ul className="list-unstyled">
      {items.map((item) => (
        <li key={item.id} className="mb-3">
          <strong>{item.author.displayName}</strong> <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
          <div className="comment-text">{item.content}</div>
        </li>
      ))}
    </ul>
  );
}

export function StaffTicketDetail({ ticketId, user, onBack }: { ticketId: string; user: CurrentUser; onBack: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const readOnly = user.role !== "IT_STAFF";
  const [state, setState] = useState<"loading" | "ready" | "notFound" | "forbidden" | "failed">("loading");
  const [loadError, setLoadError] = useState("");
  const [ticket, setTicket] = useState<Detail | null>(null);
  const [assignees, setAssignees] = useState<PersonRef[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [stale, setStale] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [tab, setTab] = useState<Tab>("public");
  const [ownerChoice, setOwnerChoice] = useState("");
  const [priorityChoice, setPriorityChoice] = useState<RequestedPriority>("LOW");
  const [drafts, setDrafts] = useState({ public: "", internal: "" });
  const [draftErrors, setDraftErrors] = useState({ public: "", internal: "" });
  const [postFailure, setPostFailure] = useState<{ public: string; internal: string }>({ public: "", internal: "" });

  const load = useCallback(() => {
    setState("loading"); setLoadError(""); setStale(false);
    getStaffTicketDetail(ticketId)
      .then((detail) => { setTicket(detail); setPriorityChoice(detail.itPriority); setState("ready"); })
      .catch((error: unknown) => {
        const apiError = error as ApiError;
        if (apiError.status === 404) setState("notFound");
        else if (apiError.status === 403) setState("forbidden");
        else { setLoadError(apiError.message || "Ticket could not be loaded."); setState("failed"); }
      });
  }, [ticketId]);
  useEffect(load, [load]);
  useEffect(() => { if (!readOnly) getAssignees().then(setAssignees).catch(() => undefined); }, [readOnly]);

  async function mutate(card: Card, path: string, method: "POST" | "PATCH", body: Record<string, unknown>, success: string) {
    if (!ticket || busy) return;
    setBusy(card); setFeedback(null); setConfirmation(null);
    try {
      const updated = await staffMutation(`${ticket.id}/${path}`, method, { ...body, version: ticket.version }, user.csrfToken);
      setTicket((current) => current ? { ...current, ...updated, publicComments: current.publicComments, internalNotes: current.internalNotes } : current);
      setPriorityChoice(updated.itPriority); setOwnerChoice(""); setStale(false);
      setFeedback({ card, kind: "success", text: success });
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.code === "STALE_TICKET") { setStale(true); setFeedback({ card, kind: "error", text: STALE_MESSAGE }); }
      else setFeedback({ card, kind: "error", text: apiError.message || "The change could not be saved. Please try again.", fields: apiError.fields });
    } finally { setBusy(""); }
  }

  async function postEntry(kind: "public" | "internal", event: FormEvent) {
    event.preventDefault();
    if (!ticket || busy) return;
    const content = drafts[kind].trim();
    const length = Array.from(content).length;
    const noun = kind === "public" ? "Comment" : "Note";
    setPostFailure((current) => ({ ...current, [kind]: "" }));
    if (length === 0) { setDraftErrors((current) => ({ ...current, [kind]: `${noun} is required.` })); return; }
    if (length > MAX_TEXT) { setDraftErrors((current) => ({ ...current, [kind]: `${noun} must contain ${MAX_TEXT} characters or fewer.` })); return; }
    setDraftErrors((current) => ({ ...current, [kind]: "" })); setBusy(kind);
    try {
      const created = kind === "public" ? await postTicketComment(ticket.id, content, user.csrfToken) : await postInternalNote(ticket.id, content, user.csrfToken);
      setTicket((current) => current ? { ...current, ...(kind === "public" ? { publicComments: [...(current.publicComments ?? []), created] } : { internalNotes: [...(current.internalNotes ?? []), created] }) } : current);
      setDrafts((current) => ({ ...current, [kind]: "" }));
      setFeedback({ card: kind, kind: "success", text: kind === "public" ? "Public comment posted." : "Internal note saved." });
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.fields?.content) setDraftErrors((current) => ({ ...current, [kind]: apiError.fields!.content }));
      else setPostFailure((current) => ({ ...current, [kind]: apiError.message || `${noun} could not be saved. Please try again.` }));
    } finally { setBusy(""); }
  }

  if (state === "loading") return <p role="status">Loading ticket…</p>;
  if (state === "notFound") return <><p role="alert">We couldn't find this ticket.</p><a href="/staff/tickets" onClick={onBack}>Back to Ticket Queue</a></>;
  if (state === "forbidden") return <p className="alert alert-warning" role="alert">Forbidden. Your account is not permitted to view this Ticket.</p>;
  if (state === "failed" || !ticket) return <div className="alert alert-danger" role="alert">{loadError} <button className="btn btn-sm btn-outline-secondary" onClick={load}>Retry</button></div>;

  const options = nextStatuses(ticket.currentStatus);
  const fb = (card: string) => feedback && feedback.card === card ? <div className={`alert ${feedback.kind === "success" ? "alert-success" : "alert-danger"} mt-2`} role={feedback.kind === "success" ? "status" : "alert"}>{feedback.text}</div> : null;
  const saving = busy !== "";

  return (
    <article className="staff-detail">
      <a href="/staff/tickets" onClick={onBack}>Back to Ticket Queue</a>
      <h1 className="mt-2">{ticket.ticketNumber}</h1>
      <p className="mb-2">
        <span className="badge badge-zen me-1">{STATUS_LABELS[ticket.currentStatus]}</span>
        <span className="badge badge-priority me-1">Requested: {PRIORITY_LABELS[ticket.requestedPriority]}</span>
        <span className="badge badge-priority me-1">IT: {PRIORITY_LABELS[ticket.itPriority]}</span>
        {ticket.owner ? <span className="badge badge-muted">Owner: {ticket.owner.displayName}</span> : <span className="badge badge-muted">Unassigned</span>}
      </p>
      <p className="small text-muted">Updated <time dateTime={ticket.updatedAt}>{formatTime(ticket.updatedAt)}</time></p>
      {readOnly && <div className="alert alert-info" role="note">Read-only administrator view</div>}
      {stale && <div className="alert alert-warning" role="alert">{STALE_MESSAGE} <button className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button></div>}

      <div className="row g-3 mb-3">
        <section className="col-12 col-lg-7" aria-label="Ticket information">
          <div className="card zen-card p-3 h-100">
            <h2 className="h5">Ticket information</h2>
            <dl className="mb-0 readonly-fields">
              <dt>Requester</dt><dd>{ticket.requester.displayName}</dd>
              <dt>Category</dt><dd>{ticket.category.name}</dd>
              <dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd>
              <dt>Requested Priority</dt><dd>{PRIORITY_LABELS[ticket.requestedPriority]}</dd>
              <dt>Summary</dt><dd className="comment-text">{ticket.summary}</dd>
              <dt>Description</dt><dd className="comment-text">{ticket.description}</dd>
              {ticket.requesterResolvedAt && <><dt>Requester indication</dt><dd>Problem appears resolved ({formatTime(ticket.requesterResolvedAt)})</dd></>}
            </dl>
          </div>
        </section>

        {!readOnly && (
          <div className="col-12 col-lg-5 d-grid gap-3">
            <section className="card zen-card p-3" aria-label="Ownership">
              <h2 className="h5">Ownership</h2>
              <p className="mb-2">Current owner: {ticket.owner ? ticket.owner.displayName : "Unassigned"}</p>
              {!ticket.owner && <button className="btn btn-primary mb-2" disabled={saving} onClick={() => void mutate("owner", "claim", "POST", {}, "You now own this Ticket.")}>{busy === "owner" ? "Saving…" : "Claim ticket"}</button>}
              <label htmlFor="owner-select" className="form-label">{ticket.owner ? "Reassign to" : "Assign to"}</label>
              <select id="owner-select" className="form-select" value={ownerChoice} disabled={saving} onChange={(event) => setOwnerChoice(event.target.value)}>
                <option value="">Select a person…</option>
                {assignees.filter((person) => person.id !== ticket.owner?.id).map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
              </select>
              {feedback?.card === "owner" && feedback.fields?.ownerId && <div className="invalid-feedback d-block">{feedback.fields.ownerId}</div>}
              <button className="btn btn-outline-primary mt-2" disabled={saving || !ownerChoice} onClick={() => {
                const person = assignees.find((item) => String(item.id) === ownerChoice)!;
                const run = () => void mutate("owner", "owner", "PATCH", { ownerId: Number(ownerChoice), confirmed: true }, `Ticket assigned to ${person.displayName}.`);
                if (ticket.owner) setConfirmation({ title: "Confirm reassignment", body: `Reassign this Ticket from ${ticket.owner.displayName} to ${person.displayName}?`, run });
                else void mutate("owner", "owner", "PATCH", { ownerId: Number(ownerChoice) }, `Ticket assigned to ${person.displayName}.`);
              }}>{ticket.owner ? "Reassign" : "Assign"}</button>
              {fb("owner")}
            </section>

            <section className="card zen-card p-3" aria-label="Priority">
              <h2 className="h5">Priority</h2>
              <p className="mb-2">Requested Priority (read-only): {PRIORITY_LABELS[ticket.requestedPriority]}</p>
              <label htmlFor="it-priority" className="form-label">IT Priority</label>
              <select id="it-priority" className="form-select" value={priorityChoice} disabled={saving} onChange={(event) => setPriorityChoice(event.target.value as RequestedPriority)}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="btn btn-outline-primary mt-2" disabled={saving || priorityChoice === ticket.itPriority} onClick={() => void mutate("priority", "it-priority", "PATCH", { itPriority: priorityChoice }, "IT Priority saved.")}>{busy === "priority" ? "Saving…" : "Save IT Priority"}</button>
              {fb("priority")}
            </section>

            <section className="card zen-card p-3" aria-label="Status">
              <h2 className="h5">Status</h2>
              <p className="mb-2">Current status: {STATUS_LABELS[ticket.currentStatus]}</p>
              {options.length === 0 ? <p className="mb-0">No further status changes.</p> : (
                <ul className="list-unstyled mb-0">
                  {options.map((option) => {
                    const blocked = option.ownerRequired && !ticket.owner;
                    const label = STATUS_LABELS[option.to];
                    const run = () => void mutate("status", "status", "PATCH", { status: option.to, ...(option.confirm ? { confirmed: true } : {}) }, `Status changed to ${label}.`);
                    return (
                      <li key={option.to} className="mb-2">
                        <button className="btn btn-outline-primary" disabled={saving || blocked} onClick={() => option.confirm ? setConfirmation({ title: `Confirm status change`, body: `Change status from ${STATUS_LABELS[ticket.currentStatus]} to ${label}?`, run }) : run()}>Move to {label}</button>
                        {blocked && <span className="ms-2 small text-muted">Assign an owner first</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {fb("status")}
            </section>
          </div>
        )}
      </div>

      {confirmation && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="card zen-card p-3 mb-3">
          <h2 id="confirm-title" className="h5">{confirmation.title}</h2>
          <p>{confirmation.body}</p>
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={confirmation.run}>Confirm</button>
            <button className="btn btn-outline-secondary" onClick={() => setConfirmation(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Ticket communication" className="d-flex flex-wrap gap-2 mb-2">
        {([["public", "Public Comments"], ["internal", "Internal Notes"], ["attachments", "Attachments"]] as const).map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={`btn ${tab === id ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "public" && (
        <section id="panel-public" role="tabpanel" aria-labelledby="tab-public" className="card zen-card p-3">
          <h2 className="h5">Public Comments</h2>
          <p className="small text-muted">Visible to the requester and support staff.</p>
          <Entries items={ticket.publicComments ?? []} empty="No public comments yet." />
          {!readOnly && (
            <form onSubmit={(event) => void postEntry("public", event)} noValidate>
              <label htmlFor="public-draft" className="form-label">Add public comment</label>
              <textarea id="public-draft" className={`form-control${draftErrors.public ? " is-invalid" : ""}`} rows={3} value={drafts.public} disabled={busy === "public"} onChange={(event) => { setDrafts({ ...drafts, public: event.target.value }); setDraftErrors({ ...draftErrors, public: "" }); }} />
              <div className="form-text">Warning: the requester will see this comment. {Array.from(drafts.public).length}/{MAX_TEXT}</div>
              {draftErrors.public && <div className="invalid-feedback d-block">{draftErrors.public}</div>}
              {postFailure.public && <div className="alert alert-danger mt-2" role="alert">{postFailure.public}</div>}
              {fb("public")}
              <button type="submit" className="btn btn-primary mt-2" disabled={saving}>{busy === "public" ? "Posting…" : "Post public comment"}</button>
            </form>
          )}
        </section>
      )}

      {tab === "internal" && (
        <section id="panel-internal" role="tabpanel" aria-labelledby="tab-internal" className="card p-3 note-surface">
          <h2 className="h5"><span aria-label="Locked">🔒</span> Internal Notes</h2>
          <p className="small">Visible only to IT Staff and Administrators. The requester cannot see these notes.</p>
          <Entries items={ticket.internalNotes ?? []} empty="No internal notes yet." />
          {!readOnly && (
            <form onSubmit={(event) => void postEntry("internal", event)} noValidate>
              <label htmlFor="internal-draft" className="form-label">Add internal note</label>
              <textarea id="internal-draft" className={`form-control${draftErrors.internal ? " is-invalid" : ""}`} rows={3} value={drafts.internal} disabled={busy === "internal"} onChange={(event) => { setDrafts({ ...drafts, internal: event.target.value }); setDraftErrors({ ...draftErrors, internal: "" }); }} />
              <div className="form-text">{Array.from(drafts.internal).length}/{MAX_TEXT}</div>
              {draftErrors.internal && <div className="invalid-feedback d-block">{draftErrors.internal}</div>}
              {postFailure.internal && <div className="alert alert-danger mt-2" role="alert">{postFailure.internal}</div>}
              {fb("internal")}
              <button type="submit" className="btn btn-primary mt-2" disabled={saving}>{busy === "internal" ? "Saving…" : "Save internal note"}</button>
            </form>
          )}
        </section>
      )}

      {tab === "attachments" && (
        <section id="panel-attachments" role="tabpanel" aria-labelledby="tab-attachments" className="card zen-card p-3">
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
      )}
    </article>
  );
}
