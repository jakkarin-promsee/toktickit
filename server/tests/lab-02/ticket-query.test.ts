import { describe, expect, it } from "vitest";
import { parseTicketQuery } from "../../src/ticket-query.js";

describe("Issue #14 ticket query contract", () => {
  it("uses documented defaults and trims search", () => {
    expect(parseTicketQuery({ search: "  laptop  " })).toEqual({
      search: "laptop",
      categoryId: undefined,
      relatedSystemId: undefined,
      status: undefined,
      requestedPriority: undefined,
      sortBy: "updatedAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("accepts all supported filters, sorting, and page sizes", () => {
    expect(
      parseTicketQuery({
        categoryId: "2",
        relatedSystemId: "7",
        status: "NEW",
        requestedPriority: "HIGH",
        sortBy: "summary",
        sortOrder: "asc",
        page: "2",
        pageSize: "50",
      }),
    ).toMatchObject({
      categoryId: 2,
      relatedSystemId: 7,
      status: "NEW",
      requestedPriority: "HIGH",
      sortBy: "summary",
      sortOrder: "asc",
      page: 2,
      pageSize: 50,
    });
  });

  it.each([
    ["unknown parameter", { nope: "1" }],
    ["duplicate parameter", { page: ["1", "2"] }],
    ["invalid page", { page: "0" }],
    ["invalid page size", { pageSize: "15" }],
    ["invalid sort field", { sortBy: "id" }],
    ["invalid priority", { requestedPriority: "URGENT" }],
    ["too-long search", { search: "x".repeat(121) }],
  ])("rejects %s", (_label, input) => {
    expect(() => parseTicketQuery(input)).toThrow();
  });
});
