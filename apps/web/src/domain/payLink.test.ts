import { describe, expect, it } from "vitest";
import { createStore } from "./store";
import { decodePayLink, encodePayLink } from "./payLink";

describe("pay links that carry their own bill", () => {
  it("round trips a bill through a link", () => {
    const store = createStore();
    const invoice = store.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const decoded = decodePayLink(encodePayLink(invoice));
    expect(decoded).toEqual({
      id: invoice.id,
      workTitle: "Logo design",
      amount: 1250,
      workerAddress: null,
      billId: null,
    });
  });

  it("version 2 links carry the worker address and chain bill number", () => {
    const store = createStore();
    const invoice = store.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const worker = `0x${"a".repeat(64)}`;
    const decoded = decodePayLink(
      encodePayLink(invoice, { workerAddress: worker, billId: 42 }),
    );
    expect(decoded?.workerAddress).toBe(worker);
    expect(decoded?.billId).toBe(42);
    expect(decoded?.amount).toBe(1250);
  });

  it("says no to version 2 links with a bad address or bill number", () => {
    const make = (fields: Record<string, unknown>) =>
      `p.${btoa(encodeURIComponent(JSON.stringify(fields)))}`;
    const base = { v: 2, id: "x", workTitle: "Job", amount: 100 };
    expect(decodePayLink(make({ ...base, worker: "0x1234", billId: 5 }))).toBeNull();
    expect(
      decodePayLink(make({ ...base, worker: `0x${"g".repeat(64)}`, billId: 5 })),
    ).toBeNull();
    expect(
      decodePayLink(make({ ...base, worker: `0x${"a".repeat(64)}`, billId: 0 })),
    ).toBeNull();
    expect(
      decodePayLink(make({ ...base, worker: `0x${"a".repeat(64)}`, billId: 1.5 })),
    ).toBeNull();
    // Claims version 2 but leaves the pay targets out: broken,
    // never quietly read as an old link.
    expect(decodePayLink(make(base))).toBeNull();
  });

  it("never carries extra fields out of a link", () => {
    const link = `p.${btoa(
      encodeURIComponent(
        JSON.stringify({
          id: "x",
          workTitle: "Job",
          amount: 100,
          secret: "should-not-ride",
          signingKey: "should-not-ride",
        }),
      ),
    )}`;
    const decoded = decodePayLink(link);
    expect(decoded).not.toBeNull();
    expect(JSON.stringify(decoded)).not.toContain("should-not-ride");
  });

  it("keeps Hindi and emoji titles safe in a link", () => {
    const store = createStore();
    const invoice = store.addInvoice({
      workTitle: "लोगो डिज़ाइन 🎨",
      amount: 10,
      clientMark: "Client A",
    });
    expect(decodePayLink(encodePayLink(invoice))?.workTitle).toBe(
      "लोगो डिज़ाइन 🎨",
    );
  });

  it("says no to garbled or wrong links", () => {
    expect(decodePayLink("p.!!!")).toBeNull();
    expect(decodePayLink("p.")).toBeNull();
    expect(decodePayLink("plain-id")).toBeNull();
    const wrongShape = `p.${btoa(encodeURIComponent(JSON.stringify({ a: 1 })))}`;
    expect(decodePayLink(wrongShape)).toBeNull();
    const badAmount = `p.${btoa(
      encodeURIComponent(
        JSON.stringify({ id: "x", workTitle: "Job", amount: -5 }),
      ),
    )}`;
    expect(decodePayLink(badAmount)).toBeNull();
  });

  it("importing a linked bill twice never makes two copies", () => {
    const store = createStore();
    const data = {
      id: "inv-link-1",
      workTitle: "Logo design",
      amount: 1250,
      workerAddress: null,
      billId: null,
    };
    store.importInvoice(data);
    store.importInvoice(data);
    expect(store.invoices.length).toBe(1);
    expect(store.getInvoice("inv-link-1")?.state).toBe("unpaid");
  });

  it("an imported bill can be paid and keeps its paid date", () => {
    const store = createStore();
    store.importInvoice({
      id: "inv-link-1",
      workTitle: "Job",
      amount: 100,
      workerAddress: null,
      billId: null,
    });
    store.payInvoice("inv-link-1", "2026-11-18");
    expect(store.getInvoice("inv-link-1")?.state).toBe("paid");
    expect(store.getInvoice("inv-link-1")?.paidOn).toBe("2026-11-18");
  });
});
