import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, createUser, CurrentUser, listUsers, setInitialPassword, updateUser, UserRole, UserSummary } from "./api.js";

const ROLE_LABELS: Record<UserRole, string> = { REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function count(value: string) { return Array.from(value).length; }

function passwordError(value: string): string | undefined {
  if (count(value) < 12 || count(value) > 128) return "Password must contain 12–128 characters.";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) return "Password must contain lowercase, uppercase, digit, and symbol characters.";
  return undefined;
}

interface FormState { displayName: string; email: string; role: UserRole; isActive: boolean; initialPassword: string; confirmPassword: string }
type Panel = { mode: "create" } | { mode: "edit"; user: UserSummary } | null;

const EMPTY_FORM: FormState = { displayName: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "", confirmPassword: "" };

function RoleBadge({ role }: { role: UserRole }) { return <span className="badge badge-zen">{ROLE_LABELS[role]}</span>; }

function StatusBadges({ user }: { user: UserSummary }) {
  return <>
    <span className="badge badge-priority me-1">{user.isActive ? "Active" : "Inactive"}</span>
    {user.mustChangePassword && <span className="badge badge-muted">Password change required</span>}
  </>;
}

export function UserManagement({ user: me }: { user: CurrentUser }) {
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "failed">("loading");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [reload, setReload] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alertText, setAlertText] = useState("");
  const [conflict, setConflict] = useState<"stale" | "">("");
  const [saving, setSaving] = useState(false);
  const [pageStatus, setPageStatus] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<(() => void) | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [reset, setReset] = useState({ password: "", confirm: "" });
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [resetFailure, setResetFailure] = useState("");
  const [resetting, setResetting] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchText.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let live = true;
    setState("loading");
    listUsers(search, role)
      .then((data) => { if (!Array.isArray(data)) throw new ApiError(500, {}); if (live) { setUsers(data); setState("ready"); } })
      .catch((error: unknown) => { if (live) setState((error as ApiError).status === 403 ? "forbidden" : "failed"); });
    return () => { live = false; };
  }, [search, role, reload]);

  useEffect(() => { if (panel) firstField.current?.focus(); }, [panel]);

  const dirty = panel !== null && JSON.stringify(form) !== JSON.stringify(original);
  const editingSelf = panel?.mode === "edit" && panel.user.id === me.id;

  function openPanel(next: Panel) {
    const start = () => {
      const values: FormState = next?.mode === "edit"
        ? { ...EMPTY_FORM, displayName: next.user.displayName, email: next.user.email, role: next.user.role, isActive: next.user.isActive }
        : EMPTY_FORM;
      setPanel(next); setForm(values); setOriginal(values); setErrors({}); setAlertText(""); setConflict(""); setConfirmSave(false); setResetOpen(false);
    };
    if (dirty) setConfirmDiscard(() => () => { setConfirmDiscard(null); start(); });
    else start();
  }

  function closePanel() {
    const close = () => { setConfirmDiscard(null); setPanel(null); setErrors({}); setAlertText(""); setConflict(""); setConfirmSave(false); };
    if (dirty) setConfirmDiscard(() => close);
    else close();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const name = form.displayName.trim();
    if (count(name) < 2 || count(name) > 100) next.displayName = "Display name must contain 2–100 characters.";
    const email = form.email.trim();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) next.email = "Enter a valid email address.";
    if (panel?.mode === "create") {
      const policy = passwordError(form.initialPassword);
      if (policy) next.initialPassword = policy;
      if (form.confirmPassword !== form.initialPassword) next.confirmPassword = "Passwords do not match.";
    }
    return next;
  }

  function mapError(error: unknown) {
    const apiError = error as ApiError;
    if (apiError.code === "STALE_USER") { setConflict("stale"); setAlertText("This user changed. Reload before trying again."); return; }
    if (apiError.fields) setErrors(apiError.fields);
    if (apiError.code === "USER_OWNS_TICKETS") setAlertText("Reassign owned Tickets before deactivating this user or changing them to Requester.");
    else if (apiError.code === "EMAIL_ALREADY_EXISTS") setErrors((current) => ({ ...current, email: "A user with this email already exists." }));
    else setAlertText(apiError.message || "The user could not be saved. Please try again.");
  }

  async function save() {
    if (!panel || saving) return;
    setSaving(true); setAlertText(""); setConfirmSave(false);
    try {
      let saved: UserSummary;
      if (panel.mode === "create") {
        saved = await createUser({ displayName: form.displayName.trim(), email: form.email.trim(), role: form.role, isActive: form.isActive, initialPassword: form.initialPassword }, me.csrfToken);
      } else {
        saved = await updateUser(panel.user.id, { displayName: form.displayName.trim(), email: form.email.trim(), role: form.role, isActive: form.isActive, version: panel.user.version }, me.csrfToken);
      }
      setPageStatus(panel.mode === "create" ? `User ${saved.displayName} created.` : `User ${saved.displayName} updated.`);
      setPanel(null); setReload((value) => value + 1);
    } catch (error) { mapError(error); }
    finally { setSaving(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (panel?.mode === "edit" && (form.role !== panel.user.role || form.isActive !== panel.user.isActive)) { setConfirmSave(true); return; }
    void save();
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (panel?.mode !== "edit" || resetting) return;
    const next: Record<string, string> = {};
    const policy = passwordError(reset.password);
    if (policy) next.password = policy;
    if (reset.confirm !== reset.password) next.confirm = "Passwords do not match.";
    setResetErrors(next); setResetFailure("");
    if (Object.keys(next).length > 0) return;
    setResetting(true);
    try {
      await setInitialPassword(panel.user.id, reset.password, me.csrfToken);
      setPageStatus(`New initial password set for ${panel.user.displayName}. They must change it at next login.`);
      setResetOpen(false); setReset({ password: "", confirm: "" }); setPanel(null); setReload((value) => value + 1);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.fields?.initialPassword) setResetErrors({ password: apiError.fields.initialPassword });
      else setResetFailure(apiError.message || "The password could not be set. Please try again.");
    } finally { setResetting(false); }
  }

  const retry = useCallback(() => setReload((value) => value + 1), []);
  const clear = () => { setSearchText(""); setSearch(""); setRole(""); };
  const filtered = search !== "" || role !== "";

  if (state === "forbidden") return <section><h1>User Management</h1><div className="alert alert-warning" role="alert">Forbidden. Your account is not permitted to manage users.</div></section>;

  const invalid = (name: string) => ({ className: `form-control${errors[name] ? " is-invalid" : ""}`, "aria-invalid": Boolean(errors[name]), disabled: saving });
  const fieldError = (name: string) => errors[name] ? <div className="invalid-feedback d-block">{errors[name]}</div> : null;

  return (
    <section aria-labelledby="user-management-heading">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 id="user-management-heading" className="mb-0">User Management</h1>
        <button className="btn btn-primary" onClick={() => openPanel({ mode: "create" })}>Create user</button>
      </div>
      {pageStatus && <div className="alert alert-success" role="status">{pageStatus}</div>}

      <form className="card zen-card p-3 mb-3" role="search" onSubmit={(event) => event.preventDefault()}>
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label htmlFor="user-search" className="form-label">Search users</label>
            <input id="user-search" type="search" className="form-control" maxLength={120} value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <div className="form-text">Name or email</div>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <label htmlFor="user-role-filter" className="form-label">Role</label>
            <select id="user-role-filter" className="form-select" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="col-12 col-sm-6 col-md-3 d-flex align-items-end"><button type="button" className="btn btn-outline-secondary" onClick={clear}>Clear</button></div>
        </div>
      </form>

      {confirmDiscard && (
        <div role="dialog" aria-modal="true" aria-labelledby="discard-title" className="card zen-card p-3 mb-3">
          <h2 id="discard-title" className="h5">Discard changes?</h2>
          <p>You have unsaved changes that will be lost.</p>
          <div className="d-flex gap-2"><button className="btn btn-primary" onClick={confirmDiscard}>Discard</button><button className="btn btn-outline-secondary" onClick={() => setConfirmDiscard(null)}>Keep editing</button></div>
        </div>
      )}

      {panel && (
        <form className="card zen-card p-3 mb-3" aria-labelledby="panel-title" onSubmit={submit} noValidate>
          <h2 id="panel-title" className="h5">{panel.mode === "create" ? "Create user" : "Edit user"}</h2>
          {conflict === "stale" && <div className="alert alert-warning" role="alert">{alertText} <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { const fresh = users.find((item) => item.id === (panel as { user: UserSummary }).user.id); void listUsers(search, role).then((data) => { setUsers(data); const latest = data.find((item) => item.id === (panel as { user: UserSummary }).user.id) ?? fresh; if (latest) openPanel({ mode: "edit", user: latest }); }); }}>Reload</button></div>}
          {alertText && conflict !== "stale" && <div className="alert alert-danger" role="alert">{alertText}</div>}
          <div className="mb-3"><label htmlFor="user-name" className="form-label">Display name</label><input id="user-name" ref={firstField} {...invalid("displayName")} value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} />{fieldError("displayName")}</div>
          <div className="mb-3"><label htmlFor="user-email" className="form-label">Email</label><input id="user-email" type="email" {...invalid("email")} value={form.email} onChange={(event) => setField("email", event.target.value)} />{fieldError("email")}</div>
          <div className="mb-3">
            <label htmlFor="user-role" className="form-label">Role</label>
            <select id="user-role" className={`form-select${errors.role ? " is-invalid" : ""}`} value={form.role} disabled={saving || editingSelf} onChange={(event) => setField("role", event.target.value as UserRole)}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {fieldError("role")}
          </div>
          <div className="form-check mb-3">
            <input id="user-active" type="checkbox" className="form-check-input" checked={form.isActive} disabled={saving || editingSelf} onChange={(event) => setField("isActive", event.target.checked)} />
            <label htmlFor="user-active" className="form-check-label">Active</label>
          </div>
          {editingSelf && <p className="small text-muted">You cannot change your own role or deactivate your own account.</p>}
          {panel.mode === "create" ? (
            <>
              <div className="mb-3"><label htmlFor="user-password" className="form-label">Initial password</label><input id="user-password" type="password" autoComplete="new-password" {...invalid("initialPassword")} value={form.initialPassword} onChange={(event) => setField("initialPassword", event.target.value)} />{fieldError("initialPassword")}<div className="form-text">12–128 characters with lowercase, uppercase, digit, and symbol. The user must change it at first login.</div></div>
              <div className="mb-3"><label htmlFor="user-confirm" className="form-label">Confirm initial password</label><input id="user-confirm" type="password" autoComplete="new-password" {...invalid("confirmPassword")} value={form.confirmPassword} onChange={(event) => setField("confirmPassword", event.target.value)} />{fieldError("confirmPassword")}</div>
            </>
          ) : (
            <p>Password change required: <strong>{panel.user.mustChangePassword ? "Yes" : "No"}</strong></p>
          )}
          {confirmSave && panel.mode === "edit" && (
            <div role="dialog" aria-modal="true" aria-labelledby="save-confirm-title" className="alert alert-warning">
              <h3 id="save-confirm-title" className="h6">Confirm role or status change</h3>
              <p>Changing the role or active state of {panel.user.displayName} ends all of their current sessions.</p>
              <button type="button" className="btn btn-primary me-2" onClick={() => void save()}>Confirm</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmSave(false)}>Cancel</button>
            </div>
          )}
          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : panel.mode === "create" ? "Create user" : "Save changes"}</button>
            {panel.mode === "edit" && <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => { setResetOpen(true); setReset({ password: "", confirm: "" }); setResetErrors({}); setResetFailure(""); }}>Set new initial password</button>}
            <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={closePanel}>Cancel</button>
          </div>
        </form>
      )}

      {resetOpen && panel?.mode === "edit" && (
        <form role="dialog" aria-modal="true" aria-labelledby="reset-title" className="card zen-card p-3 mb-3" onSubmit={(event) => void submitReset(event)} noValidate>
          <h2 id="reset-title" className="h5">Set new initial password for {panel.user.displayName}</h2>
          <p className="alert alert-warning">All current sessions for this user will end, and they must change this password at next login.</p>
          {resetFailure && <div className="alert alert-danger" role="alert">{resetFailure}</div>}
          <div className="mb-3"><label htmlFor="reset-password" className="form-label">New initial password</label><input id="reset-password" type="password" autoComplete="new-password" className={`form-control${resetErrors.password ? " is-invalid" : ""}`} value={reset.password} disabled={resetting} onChange={(event) => setReset({ ...reset, password: event.target.value })} />{resetErrors.password && <div className="invalid-feedback d-block">{resetErrors.password}</div>}</div>
          <div className="mb-3"><label htmlFor="reset-confirm" className="form-label">Confirm new initial password</label><input id="reset-confirm" type="password" autoComplete="new-password" className={`form-control${resetErrors.confirm ? " is-invalid" : ""}`} value={reset.confirm} disabled={resetting} onChange={(event) => setReset({ ...reset, confirm: event.target.value })} />{resetErrors.confirm && <div className="invalid-feedback d-block">{resetErrors.confirm}</div>}</div>
          <div className="d-flex gap-2"><button type="submit" className="btn btn-primary" disabled={resetting}>{resetting ? "Saving…" : "Set password"}</button><button type="button" className="btn btn-outline-secondary" disabled={resetting} onClick={() => setResetOpen(false)}>Cancel</button></div>
        </form>
      )}

      {state === "loading" && <p role="status">Loading users…</p>}
      {state === "failed" && <div className="alert alert-danger" role="alert">Users could not be loaded. <button className="btn btn-sm btn-outline-secondary" onClick={retry}>Retry</button></div>}
      {state === "ready" && users.length === 0 && (filtered
        ? <div className="card zen-card p-3"><h2 className="h5">No users match</h2><p>No user matches the current search or role filter.</p><div><button className="btn btn-outline-secondary" onClick={clear}>Clear</button></div></div>
        : <p>No users exist yet. Use Create user to add the first one.</p>)}

      {state === "ready" && users.length > 0 && (
        <>
          <div className="d-none d-md-block user-table">
            <table className="table zen-table align-middle">
              <caption className="visually-hidden">Users</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Edit</th></tr></thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.displayName}</td><td className="queue-summary">{item.email}</td><td><RoleBadge role={item.role} /></td><td><StatusBadges user={item} /></td>
                    <td><button className="btn btn-sm btn-outline-primary" aria-label={`Edit ${item.displayName}`} onClick={() => openPanel({ mode: "edit", user: item })}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="d-md-none list-unstyled user-cards">
            {users.map((item) => (
              <li key={item.id} className="card zen-card p-3 mb-2">
                <strong>{item.displayName}</strong>
                <div className="queue-summary">{item.email}</div>
                <div className="my-1"><RoleBadge role={item.role} /></div>
                <div className="my-1"><StatusBadges user={item} /></div>
                <div><button className="btn btn-sm btn-outline-primary" aria-label={`Edit ${item.displayName}`} onClick={() => openPanel({ mode: "edit", user: item })}>Edit</button></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
