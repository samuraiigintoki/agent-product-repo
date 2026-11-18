import { describe, expect, it } from "vitest";
import { createInvoice, markPaid, parseAmountInput, validateInvoiceInput } from "./invoice";

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

describe("invoice input checks (50 user run fixes)", () => {
  it("rejects an empty work title", () => {
    expect(() =>
      createInvoice({ workTitle: "  ", amount: 100, clientMark: "A" }),
    ).toThrow(/title/);
  });

  it("rejects zero, negative, decimal, and letter amounts", () => {
    for (const amount of [0, -50, 12.5, Number("abc")]) {
      expect(() =>
        createInvoice({ workTitle: "Job", amount, clientMark: "A" }),
      ).toThrow(/whole number above zero/);
    }
  });

  it("parses amounts the way people type them", () => {
    expect(parseAmountInput("1,250")).toBe(1250);
    expect(parseAmountInput(" 1250 ")).toBe(1250);
    expect(Number.isNaN(parseAmountInput("abc"))).toBe(true);
    expect(parseAmountInput("")).toBe(0);
  });

  it("points at the field that is wrong", () => {
    expect(
      validateInvoiceInput({ workTitle: "", amount: 100 })?.field,
    ).toBe("workTitle");
    expect(
      validateInvoiceInput({ workTitle: "Job", amount: 0 })?.field,
    ).toBe("amount");
    expect(validateInvoiceInput({ workTitle: "Job", amount: 100 })).toBeNull();
  });

  it("trims the title and client mark it stores", () => {
    const invoice = createInvoice({
      workTitle: "  Logo design  ",
      amount: 100,
      clientMark: "  Client A ",
    });
    expect(invoice.workTitle).toBe("Logo design");
    expect(invoice.clientMark).toBe("Client A");
  });
});
