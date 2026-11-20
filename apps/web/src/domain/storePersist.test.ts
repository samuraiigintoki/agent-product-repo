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

  it("marks a bill paid from the network only for the exact amount", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const bill = store.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    expect(store.markInvoicePaidOnNetwork(bill.id, 1249)).toBeUndefined();
    expect(store.getInvoice(bill.id)?.state).toBe("unpaid");
    const paid = store.markInvoicePaidOnNetwork(bill.id, 1250);
    expect(paid?.state).toBe("paid");
    expect(paid?.paidAmount).toBe(1250);
    expect(paid?.paidOn).toBeNull();
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

  it("keeps sound bills, drops a damaged one, and drops duplicate ids", () => {
    const storage = memoryStorage();
    const good = {
      id: "inv-good",
      workTitle: "Good",
      amount: 10,
      clientMark: "A",
      state: "unpaid",
      paidAmount: null,
      paidOn: null,
    };
    storage.setItem(
      BILLS_STORAGE_KEY,
      JSON.stringify([good, { nope: 1 }, { ...good, workTitle: "Copy" }]),
    );
    const store = createStore(storage);
    expect(store.invoices.map((bill) => bill.workTitle)).toEqual(["Good"]);
  });

  it("two stores on one storage keep both bills, and paid wins", () => {
    const storage = memoryStorage();
    const tabOne = createStore(storage);
    const tabTwo = createStore(storage);
    const shared = tabOne.addInvoice({
      workTitle: "Shared",
      amount: 100,
      clientMark: "A",
    });
    tabTwo.syncFromStorage();
    tabTwo.payInvoice(shared.id, "2026-11-19");
    tabOne.addInvoice({ workTitle: "Tab one", amount: 10, clientMark: "A" });
    tabTwo.addInvoice({ workTitle: "Tab two", amount: 20, clientMark: "B" });

    const after = createStore(storage);
    expect(after.invoices.map((bill) => bill.workTitle)).toEqual(
      expect.arrayContaining(["Shared", "Tab one", "Tab two"]),
    );
    expect(after.getInvoice(shared.id)?.state).toBe("paid");
  });

  it("a failed save is named, not silent", () => {
    const storage: BillStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {},
    };
    const store = createStore(storage);
    store.addInvoice({ workTitle: "Good", amount: 10, clientMark: "A" });
    expect(store.saveFailed).toBe(true);
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
