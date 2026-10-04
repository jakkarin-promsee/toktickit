import { MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, Category, getCategories, getRelatedSystems, getStaffQueue, RelatedSystem, StaffQueueResponse, StaffQueueTicket, TicketStatus } from "./api.js";

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress", WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};
const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const SORT_LABELS: Record<string, string> = { updatedAt: "Last updated", createdAt: "Created date", ticketNumber: "Ticket number", requestedPriority: "Requested priority", itPriority: "IT priority", status: "Status" };

export interface QueueState {
  search: string; categoryId: string; relatedSystemId: string; status: string; requestedPriority: string; itPriority: string; owner: string;
  sortBy: string; sortOrder: string; page: string; pageSize: string;
}

const DEFAULTS: QueueState = { search: "", categoryId: "", relatedSystemId: "", status: "", requestedPriority: "", itPriority: "", owner: "", sortBy: "updatedAt", sortOrder: "desc", page: "1", pageSize: "20" };
const KEYS = Object.keys(DEFAULTS) as (keyof QueueState)[];

export function parseQueueSearch(search: string): { state: QueueState; reset: boolean } {
  const params = new URLSearchParams(search);
  const state = { ...DEFAULTS };
  let reset = false;
  const oneOf = (key: keyof QueueState, valid: (value: string) => boolean) => {
    const values = params.getAll(key);
    if (values.length === 0) return;
    if (values.length > 1 || !valid(values[0])) { reset = true; return; }
    state[key] = values[0];
  };
  const positive = (value: string) => /^[1-9]\d*$/.test(value);
  oneOf("search", (value) => Array.from(value).length <= 120);
  oneOf("categoryId", positive);
  oneOf("relatedSystemId", positive);
  oneOf("status", (value) => value in STATUS_LABELS);
  oneOf("requestedPriority", (value) => value in PRIORITY_LABELS);
  oneOf("itPriority", (value) => value in PRIORITY_LABELS);
  oneOf("owner", (value) => value === "me" || value === "unassigned");
  oneOf("sortBy", (value) => value in SORT_LABELS);
  oneOf("sortOrder", (value) => value === "asc" || value === "desc");
  oneOf("page", positive);
  oneOf("pageSize", (value) => ["10", "20", "50"].includes(value));
  for (const key of params.keys()) if (!(KEYS as string[]).includes(key)) reset = true;
  return reset ? { state: { ...DEFAULTS }, reset } : { state, reset };
}

function toSearch(state: QueueState): string {
  const params = new URLSearchParams();
  for (const key of KEYS) if (state[key] !== DEFAULTS[key]) params.set(key, state[key]);
  const text = params.toString();
  return text ? `?${text}` : "";
}

function activeFilterCount(state: QueueState) {
  return (["search", "categoryId", "relatedSystemId", "status", "requestedPriority", "itPriority", "owner"] as const).filter((key) => state[key] !== "").length;
}

function OwnerText({ ticket }: { ticket: StaffQueueTicket }) {
  return ticket.owner ? <span>{ticket.owner.displayName}</span> : <span className="badge badge-muted">Unassigned</span>;
}

function Badges({ ticket }: { ticket: StaffQueueTicket }) {
  return <>
    <span className="badge badge-priority me-1">Requested: {PRIORITY_LABELS[ticket.requestedPriority]}</span>
    <span className="badge badge-priority">IT: {PRIORITY_LABELS[ticket.itPriority]}</span>
  </>;
}

export function StaffTicketQueue({ onOpen }: { onOpen: (event: MouseEvent<HTMLAnchorElement>, ticketId: string) => void }) {
  const initial = useRef(parseQueueSearch(window.location.search));
  const [query, setQuery] = useState<QueueState>(initial.current.state);
  const [notice, setNotice] = useState(initial.current.reset ? "The saved filters in the address were not valid, so the queue was reset to its defaults." : "");
  const [searchText, setSearchText] = useState(initial.current.state.search);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [result, setResult] = useState<StaffQueueResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "failed">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    Promise.all([getCategories(), getRelatedSystems()]).then(([cats, syss]) => { setCategories(cats); setSystems(syss); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onPopState = () => { const next = parseQueueSearch(window.location.search); setQuery(next.state); setSearchText(next.state.search); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const normalized = searchText.trim();
    if (normalized === query.search) return;
    const timer = window.setTimeout(() => update({ search: normalized }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, query.search]);

  const key = toSearch(query);
  useEffect(() => {
    let live = true;
    setStatus("loading");
    getStaffQueue(key)
      .then((data) => { if (live) { setResult(data); setStatus("ready"); } })
      .catch((error: unknown) => { if (live) setStatus((error as ApiError).status === 403 ? "forbidden" : "failed"); });
    return () => { live = false; };
  }, [key, reload]);

  function update(partial: Partial<QueueState>) {
    setNotice("");
    setQuery((current) => {
      const next = { ...current, ...partial };
      if (!("page" in partial)) next.page = "1";
      window.history.replaceState({}, "", `${window.location.pathname}${toSearch(next)}`);
      return next;
    });
  }

  const clear = () => { setSearchText(""); update({ ...DEFAULTS, sortBy: query.sortBy, sortOrder: query.sortOrder, pageSize: query.pageSize }); };
  const retry = useCallback(() => setReload((value) => value + 1), []);

  if (status === "forbidden") return <section><h1>Ticket Queue</h1><div className="alert alert-warning" role="alert">Forbidden. Your account is not permitted to view the Ticket Queue.</div></section>;

  const filtered = activeFilterCount(query) > 0;
  const pagination = result?.pagination;
  const loading = status === "loading";
  const start = pagination && pagination.totalItems > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = pagination && result ? start + result.data.length - 1 : 0;
  const select = (id: string, label: string, name: keyof QueueState, options: [string, string][]) => (
    <div className="col-12 col-sm-6 col-lg-3">
      <label htmlFor={id} className="form-label">{label}</label>
      <select id={id} className="form-select" value={query[name]} onChange={(event) => update({ [name]: event.target.value })}>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </div>
  );

  return (
    <section aria-labelledby="queue-heading" aria-busy={loading}>
      <h1 id="queue-heading">Ticket Queue</h1>
      <div className="row g-2 mb-3" aria-label="Queue summary">
        {([["Total tickets", result?.counts.total], ["Unassigned", result?.counts.unassigned], ["Mine", result?.counts.mine]] as const).map(([label, value]) => (
          <div key={label} className="col-4"><div className="card zen-card p-2 text-center"><div className="small text-muted">{label}</div><strong>{value ?? "…"}</strong></div></div>
        ))}
      </div>

      <form className="card zen-card p-3 mb-3" role="search" onSubmit={(event) => event.preventDefault()}>
        <div className="row g-2">
          <div className="col-12 col-lg-6">
            <label htmlFor="queue-search" className="form-label">Search tickets</label>
            <input id="queue-search" type="search" className="form-control" maxLength={120} value={searchText} aria-describedby="queue-search-help" onChange={(event) => setSearchText(event.target.value)} />
            <div id="queue-search-help" className="form-text">Ticket number, summary, requester name, or email</div>
          </div>
          {select("queue-category", "Category", "categoryId", [["", "All categories"], ...categories.map((item) => [String(item.id), item.name] as [string, string])])}
          {select("queue-system", "Related System", "relatedSystemId", [["", "All systems"], ...systems.map((item) => [String(item.id), item.name] as [string, string])])}
          {select("queue-status", "Status", "status", [["", "All statuses"], ...Object.entries(STATUS_LABELS)])}
          {select("queue-requested", "Requested Priority", "requestedPriority", [["", "Any"], ...Object.entries(PRIORITY_LABELS)])}
          {select("queue-it-priority", "IT Priority", "itPriority", [["", "Any"], ...Object.entries(PRIORITY_LABELS)])}
          {select("queue-owner", "Owner", "owner", [["", "All owners"], ["me", "My tickets"], ["unassigned", "Unassigned"]])}
          {select("queue-sort", "Sort by", "sortBy", Object.entries(SORT_LABELS))}
          {select("queue-order", "Direction", "sortOrder", [["desc", "Descending"], ["asc", "Ascending"]])}
          {select("queue-page-size", "Page size", "pageSize", [["10", "10"], ["20", "20"], ["50", "50"]])}
          <div className="col-12 col-sm-6 col-lg-3 d-flex align-items-end"><button type="button" className="btn btn-outline-secondary" onClick={clear}>Clear filters</button></div>
        </div>
      </form>

      {notice && <div className="alert alert-info" role="status">{notice}</div>}
      {loading && <p role="status">{result ? "Updating results…" : "Loading tickets…"}</p>}
      {status === "failed" && <div className="alert alert-danger" role="alert">Tickets could not be loaded. Your filters are unchanged. <button className="btn btn-sm btn-outline-secondary" onClick={retry}>Retry</button></div>}

      {status === "ready" && result && result.counts.total === 0 && <p>No tickets exist yet. New Requester tickets will appear here for the support team to claim.</p>}
      {status === "ready" && result && result.counts.total > 0 && result.data.length === 0 && (
        <div className="card zen-card p-3"><h2 className="h5">No tickets match</h2><p>{filtered ? `${activeFilterCount(query)} active filter(s) did not match any ticket.` : "This page has no results."}</p><div><button className="btn btn-outline-secondary" onClick={clear}>Clear filters</button></div></div>
      )}

      {status === "ready" && result && result.data.length > 0 && (
        <>
          <p aria-live="polite">Showing {start}–{end} of {pagination!.totalItems}</p>
          <div className="d-none d-md-block queue-table">
            <table className="table zen-table align-middle">
              <caption className="visually-hidden">Ticket queue</caption>
              <thead>
                <tr>
                  {([["ticketNumber", "Ticket"], [null, "Summary"], [null, "Priority"], ["status", "Status"], [null, "Owner"], ["updatedAt", "Last updated"], [null, "View"]] as const).map(([field, label]) => (
                    <th key={label} scope="col" aria-sort={field && query.sortBy === field ? (query.sortOrder === "asc" ? "ascending" : "descending") : field ? "none" : undefined}>
                      {field ? <button type="button" className="btn btn-link p-0" onClick={() => update({ sortBy: field, sortOrder: query.sortBy === field && query.sortOrder === "asc" ? "desc" : "asc" })}>{label}</button> : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.ticketNumber}</td>
                    <td className="queue-summary">{ticket.summary}<div className="small text-muted">{ticket.requester.displayName}</div></td>
                    <td><Badges ticket={ticket} /></td>
                    <td><span className="badge badge-zen">{STATUS_LABELS[ticket.currentStatus]}</span></td>
                    <td><OwnerText ticket={ticket} /></td>
                    <td><time dateTime={ticket.updatedAt}>{new Date(ticket.updatedAt).toLocaleString()}</time></td>
                    <td><a href={`/staff/tickets/${ticket.id}`} aria-label={`View ${ticket.ticketNumber}`} onClick={(event) => onOpen(event, ticket.id)}>View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="d-md-none list-unstyled queue-cards">
            {result.data.map((ticket) => (
              <li key={ticket.id} className="card zen-card p-3 mb-2">
                <strong>{ticket.ticketNumber}</strong>
                <div className="queue-summary">{ticket.summary}</div>
                <div className="small text-muted">Requester: {ticket.requester.displayName}</div>
                <div className="my-1"><Badges ticket={ticket} /></div>
                <div className="my-1"><span className="badge badge-zen">{STATUS_LABELS[ticket.currentStatus]}</span></div>
                <div>Owner: <OwnerText ticket={ticket} /></div>
                <div className="small">Updated <time dateTime={ticket.updatedAt}>{new Date(ticket.updatedAt).toLocaleString()}</time></div>
                <a href={`/staff/tickets/${ticket.id}`} aria-label={`View ${ticket.ticketNumber}`} onClick={(event) => onOpen(event, ticket.id)}>View</a>
              </li>
            ))}
          </ul>
          <nav aria-label="Queue pagination" className="d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-outline-secondary" disabled={!pagination!.hasPreviousPage} onClick={() => update({ page: String(pagination!.page - 1) })}>Previous</button>
            <span>Page {pagination!.page} of {pagination!.totalPages}</span>
            <button className="btn btn-outline-secondary" disabled={!pagination!.hasNextPage} onClick={() => update({ page: String(pagination!.page + 1) })}>Next</button>
          </nav>
        </>
      )}
    </section>
  );
}
