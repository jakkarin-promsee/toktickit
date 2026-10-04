import { KeyboardEvent, ReactNode, useEffect, useRef } from "react";
import type { TicketStatus, UserRole } from "./api.js";

// Shared Zen Green vocabulary so every screen renders the same badge text and tint.
export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress", WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};
export const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
export const ROLE_LABELS: Record<UserRole, string> = { REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" };

const slug = (value: string) => value.toLowerCase().replace(/_/g, "-");

/** Full status text with a restrained semantic tint; the text alone carries the meaning. */
export function StatusBadge({ status, className = "" }: { status: TicketStatus; className?: string }) {
  return <span className={`badge badge-status badge-status-${slug(status)} ${className}`.trim()}>{STATUS_LABELS[status]}</span>;
}

/** Requested and IT Priority share a palette but always carry their own text prefix. */
export function PriorityBadge({ kind, priority, className = "" }: { kind: "Requested" | "IT"; priority: string; className?: string }) {
  return <span className={`badge badge-priority badge-priority-${slug(priority)} ${className}`.trim()}>{kind}: {PRIORITY_LABELS[priority]}</span>;
}

export function RoleBadge({ role, className = "" }: { role: UserRole; className?: string }) {
  return <span className={`badge badge-role badge-role-${slug(role)} ${className}`.trim()}>{ROLE_LABELS[role]}</span>;
}

export function AccountBadge({ state, className = "" }: { state: "Active" | "Inactive" | "Password change required"; className?: string }) {
  return <span className={`badge badge-account badge-account-${slug(state.replace(/ /g, "_"))} ${className}`.trim()}>{state}</span>;
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Accessible modal dialog: labelled title, initial focus on the element marked
 * `data-autofocus` (Cancel for confirmations), Tab containment, Escape to cancel,
 * and focus restored to the trigger when it closes.
 */
export function ModalDialog({ labelledBy, describedBy, onCancel, children, className = "" }: { labelledBy: string; describedBy?: string; onCancel: () => void; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const root = panel.current!;
    const target = root.querySelector<HTMLElement>("[data-autofocus]") ?? root.querySelector<HTMLElement>(FOCUSABLE) ?? root;
    target.focus();
    return () => { if (trigger && document.contains(trigger)) trigger.focus(); };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); cancel.current(); return; }
    if (event.key !== "Tab") return;
    const items = [...panel.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) { event.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="zen-dialog-backdrop">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex={-1} className={`card zen-card zen-dialog p-3 ${className}`.trim()} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}

/** Moves focus to the first invalid control after a validation pass renders. */
export function focusFirstInvalid(container: HTMLElement | null) {
  window.setTimeout(() => container?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(), 0);
}

/** Error id helper so every invalid field can point aria-describedby at its adjacent message. */
export function describedBy(...ids: (string | false | undefined)[]) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}
