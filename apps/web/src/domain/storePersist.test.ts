import { describe, expect, it } from "vitest";
import { BILLS_STORAGE_KEY, createStore, type BillStorage } from "./store";

function memoryStorage(): BillStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

describe("bills survive a refresh (Task 6)", () => {
  it("a new store on the same storage reads the same bills back", () => {
    const storage = memoryStorage();
    const first = createStore(storage);
    const bill = first.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    first.payInvoice(bill.id, "2026-11-19");

    const second = createStore(storage);
    expect(second.invoices.length).toBe(1);
    expect(second.getInvoice(bill.id)?.workTitle).toBe("Logo design");
    expect(second.getInvoice(bill.id)?.state).toBe("paid");
    expect(second.getInvoice(bill.id)?.paidOn).toBe("2026-11-19");
  });

  it("damaged stored text loads as an empty list, no crash", () => {
    const storage = memoryStorage();
    storage.setItem(BILLS_STORAGE_KEY, "not json at all {");
    expect(() => createStore(storage)).not.toThrow();
    expect(createStore(storage).invoices).toEqual([]);
  });

  it("stored text with the wrong shape loads as an empty list", () => {
    const storage = memoryStorage();
    storage.setItem(BILLS_STORAGE_KEY, JSON.stringify([{ nope: 1 }]));
    expect(createStore(storage).invoices).toEqual([]);
    storage.setItem(BILLS_STORAGE_KEY, JSON.stringify({ bills: [] }));
    expect(createStore(storage).invoices).toEqual([]);
  });

  it("a bill keeps its network pay target across a refresh", () => {
    const storage = memoryStorage();
    const first = createStore(storage);
    const bill = first.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    first.markInvoiceOnChain(bill.id, {
      workerAddress: `0x${"a".repeat(64)}`,
      billId: 42,
    });

    const second = createStore(storage);
    expect(second.getInvoice(bill.id)?.chainWorkerAddress).toBe(
      `0x${"a".repeat(64)}`,
    );
    expect(second.getInvoice(bill.id)?.chainBillId).toBe(42);
  });

  it("what is stored holds bills only, nothing key shaped", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const stored = storage.raw.get(BILLS_STORAGE_KEY) ?? "";
    expect(stored).toContain("Logo design");
    expect(stored).not.toContain("ppv1.");
    expect(stored).not.toContain("pp-backup.");
    expect(stored).not.toContain("secret");
    expect(stored).not.toContain("signingKey");
    expect(stored).not.toContain("password");
  });
});
