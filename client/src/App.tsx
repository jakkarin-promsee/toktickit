import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { ApiError, changePassword, CurrentUser, getCurrentUser, login, logout } from "./api.js";

document.documentElement.dataset.theme = "zen-green";

function count(value: string) { return Array.from(value).length; }

function newPasswordError(value: string): string | undefined {
  if (count(value) < 12 || count(value) > 128) return "Password must contain 12–128 characters.";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) return "Password must contain lowercase, uppercase, digit, and symbol characters.";
  return undefined;
}

export default function App() {
  const [state, setState] = useState<"checking" | "anonymous" | "authenticated">("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    getCurrentUser().then((current) => { if (live) { setUser(current); setState("authenticated"); } }).catch(() => { if (live) setState("anonymous"); });
    return () => { live = false; };
  }, []);
  if (state === "checking") return <main className="container py-5"><p role="status">Checking your session…</p></main>;
  if (state === "anonymous") return <Login onSignedIn={(current) => { setUser(current); setState("authenticated"); }} notice={notice} />;
  if (!user) return null;
  if (user.mustChangePassword) return <ChangePassword user={user} onChanged={(current) => { setUser(current); setNotice("Password changed"); }} onLoggedOut={() => { setUser(null); setState("anonymous"); }} />;
  return <Shell user={user} notice={notice} onChangePassword={() => setUser({ ...user, mustChangePassword: true })} onLoggedOut={() => { setUser(null); setState("anonymous"); setNotice(""); }} />;
}

function Login({ onSignedIn, notice }: { onSignedIn: (user: CurrentUser) => void; notice: string }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [show, setShow] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({}); const [failure, setFailure] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); const next: Record<string, string> = {};
    if (!email.trim()) next.email = "Email is required."; else if (!/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 254) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required."; else if (password.length > 128) next.password = "Password must contain 128 characters or fewer.";
    setErrors(next); setFailure(""); if (Object.keys(next).length) return; setBusy(true);
    try { onSignedIn(await login(email, password)); } catch (error) { const apiError = error as ApiError; setPassword(""); setFailure(apiError.status === 429 ? `Too many sign-in attempts. Try again in ${apiError.retryAfter ?? "a few"} minutes.` : "Sign-in failed. Check your credentials or account status."); } finally { setBusy(false); }
  }
  return <main className="container py-5 auth-page"><section className="card zen-card shadow-sm p-4 mx-auto auth-card" aria-labelledby="login-heading"><h1 className="h3">TokTickIT</h1><h2 id="login-heading" className="h4">Sign in</h2><p>Use your TokTickIT email address and password.</p>{notice && <div role="status" className="alert alert-success">{notice}</div>}{failure && <div role="alert" className="alert alert-danger">{failure}</div>}<form onSubmit={(event) => void submit(event)} noValidate><label className="form-label" htmlFor="login-email">Email</label><input id="login-email" className="form-control" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} disabled={busy} />{errors.email && <div className="text-danger" role="alert">{errors.email}</div>}<label className="form-label mt-3" htmlFor="login-password">Password</label><input id="login-password" className="form-control" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} disabled={busy} />{errors.password && <div className="text-danger" role="alert">{errors.password}</div>}<button type="button" className="btn btn-link px-0" aria-pressed={show} onClick={() => setShow((value) => !value)} disabled={busy}>Show password</button><button className="btn btn-success w-100" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Signing in…" : "Sign in"}</button></form></section></main>;
}

function ChangePassword({ user, onChanged, onLoggedOut }: { user: CurrentUser; onChanged: (user: CurrentUser) => void; onLoggedOut: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [errors, setErrors] = useState<Record<string, string>>({}); const [failure, setFailure] = useState(""); const [busy, setBusy] = useState(false); const [logoutBusy, setLogoutBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); const next: Record<string, string> = {}; if (!currentPassword) next.currentPassword = "Current password is required."; const policy = newPasswordError(newPassword); if (policy) next.newPassword = policy; if (newPassword === currentPassword) next.newPassword = "New password must differ from current password."; if (confirmation !== newPassword) next.confirmation = "Passwords do not match."; setErrors(next); setFailure(""); if (Object.keys(next).length) return; setBusy(true);
    try { onChanged(await changePassword(currentPassword, newPassword, user.csrfToken)); } catch (error) { const apiError = error as ApiError; setErrors(apiError.fields ?? {}); setFailure(apiError.fields ? "Check the highlighted fields." : "We could not change your password right now. Try again."); } finally { setBusy(false); }
  }
  async function signOut() { setLogoutBusy(true); try { await logout(user.csrfToken); onLoggedOut(); } catch { setFailure("We could not sign you out. Try again."); setLogoutBusy(false); } }
  return <main className="container py-5 auth-page"><section className="card zen-card shadow-sm p-4 mx-auto auth-card" aria-labelledby="change-password-heading"><h1 className="h3">TokTickIT</h1><h2 id="change-password-heading" className="h4">Change your initial password before continuing</h2><p>Password must be 12–128 characters and include lowercase, uppercase, digit, and symbol characters.</p>{failure && <div className="alert alert-danger" role="alert">{failure}</div>}<form onSubmit={(event) => void submit(event)} noValidate><PasswordField id="current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} error={errors.currentPassword} disabled={busy || logoutBusy} /><PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} error={errors.newPassword} disabled={busy || logoutBusy} /><PasswordField id="confirm-new-password" label="Confirm new password" value={confirmation} onChange={setConfirmation} error={errors.confirmation} disabled={busy || logoutBusy} /><button className="btn btn-success w-100 mt-3" type="submit" disabled={busy || logoutBusy} aria-busy={busy}>{busy ? "Changing password…" : "Change password"}</button></form><button className="btn btn-outline-secondary w-100 mt-2" onClick={() => void signOut()} disabled={busy || logoutBusy}>{logoutBusy ? "Signing out…" : "Logout"}</button></section></main>;
}

function PasswordField({ id, label, value, onChange, error, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; disabled: boolean }) { return <div className="mt-3"><label className="form-label" htmlFor={id}>{label}</label><input id={id} className="form-control" type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} disabled={disabled} />{error && <div className="text-danger" role="alert">{error}</div>}</div>; }

function Shell({ user, notice, onChangePassword, onLoggedOut }: { user: CurrentUser; notice: string; onChangePassword: () => void; onLoggedOut: () => void }) {
  const [busy, setBusy] = useState(false); const [failure, setFailure] = useState(""); const [path, setPath] = useState(() => window.location.pathname);
  const destinations = user.role === "REQUESTER" ? [{ path: "/tickets", label: "My Tickets" }] : user.role === "IT_STAFF" ? [{ path: "/staff/tickets", label: "Ticket Queue" }] : [{ path: "/admin/users", label: "User Management" }];
  const allowedPaths = new Set(["/", ...destinations.map((destination) => destination.path)]);
  const forbidden = !allowedPaths.has(path);
  const home = destinations[0];
  useEffect(() => { const onPopState = () => setPath(window.location.pathname); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  function navigate(event: MouseEvent<HTMLAnchorElement>, nextPath: string) { event.preventDefault(); window.history.pushState({}, "", nextPath); setPath(nextPath); }
  async function signOut() { setBusy(true); setFailure(""); try { await logout(user.csrfToken); onLoggedOut(); } catch { setFailure("We could not sign you out. Try again."); setBusy(false); } }
  return <><header className="app-header p-3"><div className="container d-flex flex-wrap justify-content-between gap-2"><strong>TokTickIT</strong><nav aria-label="Main navigation">{destinations.map((destination) => <a key={destination.path} href={destination.path} className="btn btn-sm btn-outline-light me-2" onClick={(event) => navigate(event, destination.path)}>{destination.label}</a>)}</nav><span>{user.displayName} <span className="badge text-bg-light">{user.role}</span></span><div><button className="btn btn-sm btn-outline-light me-2" onClick={onChangePassword} disabled={busy}>Change password</button><button className="btn btn-sm btn-light" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Logout"}</button></div></div></header><main className="container py-5">{forbidden ? <><h1>Access restricted</h1><p role="alert">You do not have access to this destination.</p></> : <><h1>{home.label}</h1><p>Your role-specific workspace will be added in the next Lab 3 issues.</p></>}{notice && <div className="alert alert-success" role="status">{notice}</div>}{failure && <div className="alert alert-danger" role="alert">{failure}</div>}</main></>;
}
