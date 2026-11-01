import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { accounts, apiSession, apiUrl, csrfHeaders, unique } from "../lab-03/helpers";

export async function freshTicket(request: APIRequestContext, label: string) {
  const headers = await apiSession(request, accounts.anan.email);
  const summary = unique(label);
  const response = await request.post(`${apiUrl}/api/tickets`, { headers, data: { categoryId: 1, relatedSystemId: 1, summary, requestedPriority: "MEDIUM", description: "Synthetic isolated Lab 4 E2E fixture." } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string; ticketNumber: string; version: number; summary: string };
}

export async function staffTicket(page: Page, ticketId: string) {
  const response = await page.request.get(`${apiUrl}/api/staff/tickets/${ticketId}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).data as { version: number; currentStatus: string; owner: { id: number } | null };
}

export async function actions(page: Page, ticketId: string) {
  const response = await page.request.get(`${apiUrl}/api/tickets/${ticketId}/actions`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).data as Array<{ id: string; version: number; ticketVersion: number; description: string; status: string; assignee: { id: number; displayName: string } | null }>;
}

export async function createAction(page: Page, ticketId: string, description: string, result = "") {
  const ticket = await staffTicket(page, ticketId);
  const headers = { ...await csrfHeaders(page), "Idempotency-Key": randomUUID() };
  const response = await page.request.post(`${apiUrl}/api/tickets/${ticketId}/actions`, { headers, data: { ticketVersion: ticket.version, actionAt: new Date().toISOString(), description, result, assigneeId: null, followUpRequired: false, followUpNote: null, attachmentNotes: null } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string; version: number; ticketVersion: number };
}

export async function screenshot(page: Page, folder: string, name: string, fullPage = true) {
  const dir = `artifacts/lab-04/screenshots/${folder}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage, animations: "disabled" });
}
