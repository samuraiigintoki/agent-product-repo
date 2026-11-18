import { describe, expect, it } from "vitest";
import { createInvoice, markPaid } from "./invoice";

describe("createInvoice", () => {
  it("starts unpaid and keeps the work title, amount, and client mark", () => {
    const invoice = createInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    expect(invoice.id.length).toBeGreaterThan(0);
    expect(invoice.workTitle).toBe("Logo design");
    expect(invoice.amount).toBe(1250);
    expect(invoice.clientMark).toBe("Client A");
    expect(invoice.state).toBe("unpaid");
  });

  it("gives each invoice its own id", () => {
    const a = createInvoice({ workTitle: "A job", amount: 10, clientMark: "Client A" });
    const b = createInvoice({ workTitle: "B job", amount: 10, clientMark: "Client A" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("markPaid", () => {
  it("is paid in full only at the exact amount", () => {
    const invoice = createInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const paid = markPaid(invoice, 1250, "2026-11-18");
    expect(paid.state).toBe("paid");
    expect(paid.paidOn).toBe("2026-11-18");
    expect(paid.paidAmount).toBe(1250);
  });

  it("stays unpaid when less is paid", () => {
    const invoice = createInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const result = markPaid(invoice, 1000, "2026-11-18");
    expect(result.state).toBe("unpaid");
    expect(result.paidOn).toBeNull();
  });

  it("stays unpaid when more is paid, since version one has no overpay flag", () => {
    const invoice = createInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const result = markPaid(invoice, 1300, "2026-11-18");
    expect(result.state).toBe("unpaid");
    expect(result.paidOn).toBeNull();
  });

  it("does not change the first invoice", () => {
    const invoice = createInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    markPaid(invoice, 1250, "2026-11-18");
    expect(invoice.state).toBe("unpaid");
  });
});
