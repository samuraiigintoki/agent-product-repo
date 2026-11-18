import { describe, expect, it } from "vitest";
import { createStore, sixMonthsFrom } from "./store";

describe("store fixes from the 50 user run", () => {
  it("a second pay never rewrites the first paid date", () => {
    const store = createStore();
    const invoice = store.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    store.payInvoice(invoice.id, "2026-11-18");
    store.payInvoice(invoice.id, "2026-12-25");
    expect(store.getInvoice(invoice.id)?.paidOn).toBe("2026-11-18");
  });

  it("six months from Aug 31 lands on the last day of Feb", () => {
    expect(sixMonthsFrom("2026-08-31")).toBe("2027-02-28");
    expect(sixMonthsFrom("2026-11-18")).toBe("2027-05-18");
  });
});
