// Brutal campaign, local crowd. This is a LOCAL run: 400
// in-memory stores stand in for 400 users. It is not 400
// live chain wallets and proves nothing about live scale.
import { describe, expect, it } from "vitest";
import { BILLS_STORAGE_KEY, createStore, type BillStorage } from "./store";
import {
  createInvoice,
  parseAmountInput,
  validateInvoiceInput,
} from "./invoice";
import { decodePayLink, encodePayLink } from "./payLink";

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

const worker = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

describe("brutal campaign: local crowd and storage attacks", () => {
  it("400 local users: 200 workers, 200 clients, repeat link opens stay one bill", () => {
    const start = Date.now();
    let opened = 0;
    for (let i = 0; i < 200; i += 1) {
      const workerStore = createStore(memoryStorage());
      const bill = workerStore.addInvoice({
        workTitle: i % 10 === 0 ? "Ünïcode work ✓ ".repeat(6).slice(0, 120) : `Work ${i}`,
        amount: 100 + i,
        clientMark: `Client ${i}`,
      });
      const link = encodePayLink(bill, {
        workerAddress: worker(i + 1),
        billId: i + 1,
      });
      const clientStore = createStore(memoryStorage());
      const data = decodePayLink(link);
      expect(data).not.toBeNull();
      // The same link opened three times still makes one bill,
      // and what is shown is what would be paid.
      for (let open = 0; open < 3; open += 1) {
        const imported = clientStore.importInvoice(data!);
        opened += 1;
        expect(imported.amount).toBe(data!.amount);
        expect(imported.chainWorkerAddress).toBe(data!.workerAddress);
        expect(imported.chainBillId).toBe(data!.billId);
      }
      expect(clientStore.invoices).toHaveLength(1);
      expect(clientStore.invoices[0].side).toBe("sent");
    }
    console.log(
      `BRUTAL local crowd: 400 users, ${opened} link opens in ${Date.now() - start}ms`,
    );
  });

  it("two tabs race 200 writes and pays; reload keeps all, paid wins, network paid wins over device paid", () => {
    const storage = memoryStorage();
    const tabOne = createStore(storage);
    const tabTwo = createStore(storage);
    const shared = tabOne.addInvoice({
      workTitle: "Shared",
      amount: 700,
      clientMark: "A",
    });
    tabTwo.syncFromStorage();

    for (let i = 0; i < 100; i += 1) {
      tabOne.addInvoice({ workTitle: `One ${i}`, amount: 10 + i, clientMark: "A" });
      tabTwo.addInvoice({ workTitle: `Two ${i}`, amount: 20 + i, clientMark: "B" });
    }
    // One tab pays on the device only; the other learns the
    // network paid truth. A later stale save must not demote
    // the network truth back to a device-only mark.
    tabOne.payInvoice(shared.id, "2026-11-19");
    tabTwo.syncFromStorage();
    tabTwo.markInvoicePaidOnNetwork(shared.id, 700);
    tabOne.addInvoice({ workTitle: "Stale tab write", amount: 1, clientMark: "A" });

    const after = createStore(storage);
    expect(after.invoices).toHaveLength(202);
    expect(new Set(after.invoices.map((bill) => bill.id)).size).toBe(202);
    const sharedAfter = after.getInvoice(shared.id);
    expect(sharedAfter?.state).toBe("paid");
    expect(sharedAfter?.paidOnNetwork).toBe(true);
  });

  it("link clash pack: changed amount, title, worker, or bill number all stop", () => {
    const maker = createStore(memoryStorage());
    const real = maker.addInvoice({
      workTitle: "Real work",
      amount: 500,
      clientMark: "A",
    });
    const base = {
      id: real.id,
      workTitle: "Real work",
      amount: 500,
      workerAddress: worker(7),
      billId: 3,
    };
    const clashes = [
      { ...base, amount: 1 },
      { ...base, amount: 501 },
      { ...base, workTitle: "Fake work" },
      { ...base, workerAddress: worker(8) },
      { ...base, billId: 4 },
      { ...base, amount: 500, workTitle: "Real work " },
    ];
    for (const clash of clashes) {
      const client = createStore(memoryStorage());
      client.importInvoice(base);
      expect(client.getPayLinkConflict(clash)).not.toBeNull();
      // The bill already on the device is untouched.
      expect(client.getInvoice(real.id)?.amount).toBe(500);
      expect(client.getInvoice(real.id)?.chainBillId).toBe(3);
    }
  });

  it("malformed link pack: unsafe amounts, oversized titles, bad targets decode as broken", () => {
    const raw = (value: unknown) =>
      `p.${btoa(encodeURIComponent(JSON.stringify(value)))}`;
    const good = {
      v: 2,
      id: "inv-x",
      workTitle: "Work",
      amount: 500,
      worker: worker(1),
      billId: 1,
    };
    const broken: unknown[] = [
      { ...good, amount: 9007199254740993 },
      { ...good, amount: 1.5 },
      { ...good, amount: 0 },
      { ...good, amount: -5 },
      { ...good, workTitle: "x".repeat(121) },
      { ...good, workTitle: "   " },
      { ...good, billId: 0 },
      { ...good, billId: -1 },
      { ...good, billId: 1.5 },
      { ...good, billId: 9007199254740993 },
      { ...good, worker: "0x1234" },
      { ...good, worker: undefined },
      { ...good, v: 3 },
      { ...good, v: 2, billId: undefined },
      null,
      "text",
      42,
    ];
    for (const item of broken) {
      expect(decodePayLink(raw(item))).toBeNull();
    }
    expect(decodePayLink("p.not-base64!!")).toBeNull();
    expect(decodePayLink("")).toBeNull();
  });

  it("mutated links that still decode show exactly the amount they would pay", () => {
    const maker = createStore(memoryStorage());
    const bill = maker.addInvoice({
      workTitle: "Mutation base",
      amount: 500,
      clientMark: "A",
    });
    const link = encodePayLink(bill, {
      workerAddress: worker(9),
      billId: 12,
    });
    let decoded = 0;
    for (let i = 0; i < link.length && decoded < 200; i += 1) {
      const mutated =
        link.slice(0, i) + (link[i] === "A" ? "B" : "A") + link.slice(i + 1);
      const data = decodePayLink(mutated);
      if (data) {
        decoded += 1;
        const store = createStore(memoryStorage());
        const imported = store.importInvoice(data);
        // Shown amount and pay amount are the same number:
        // the pay page pays the imported bill's amount.
        expect(imported.amount).toBe(data.amount);
        expect(imported.workTitle).toBe(data.workTitle);
      }
    }
    console.log(`BRUTAL link mutations: ${decoded} still decoded, all consistent`);
  });

  it("damaged storage pack: lying paid records and orphan chain targets are dropped, sound bills survive", () => {
    const storage = memoryStorage();
    const sound = Array.from({ length: 100 }, (_, i) => ({
      id: `inv-sound-${i}`,
      workTitle: `Sound ${i}`,
      amount: 100 + i,
      clientMark: "A",
      state: "unpaid",
      paidAmount: null,
      paidOn: null,
    }));
    const damaged: unknown[] = [
      // Paid in name, but the paid amount does not match.
      { id: "inv-lie", workTitle: "Lie", amount: 500, clientMark: "A", state: "paid", paidAmount: 1, paidOn: "2026-01-01" },
      // Unpaid, but carrying a paid amount.
      { id: "inv-lie2", workTitle: "Lie 2", amount: 500, clientMark: "A", state: "unpaid", paidAmount: 500, paidOn: null },
      // Chain target with no worker to pay.
      { id: "inv-orphan", workTitle: "Orphan", amount: 500, clientMark: "A", state: "unpaid", paidAmount: null, paidOn: null, chainBillId: 4 },
      // Unsafe amount.
      { id: "inv-unsafe", workTitle: "Unsafe", amount: 9007199254740993, clientMark: "A", state: "unpaid", paidAmount: null, paidOn: null },
      // Duplicate of a sound bill.
      { ...sound[0], workTitle: "Copy" },
      // Bad paid date.
      { id: "inv-date", workTitle: "Date", amount: 5, clientMark: "A", state: "paid", paidAmount: 5, paidOn: "not-a-date" },
      // Unknown side.
      { id: "inv-side", workTitle: "Side", amount: 5, clientMark: "A", state: "unpaid", paidAmount: null, paidOn: null, side: "theirs" },
    ];
    storage.setItem(BILLS_STORAGE_KEY, JSON.stringify([...sound, ...damaged]));
    const store = createStore(storage);
    expect(store.invoices).toHaveLength(100);
    expect(store.getInvoice("inv-lie")).toBeUndefined();
    expect(store.getInvoice("inv-orphan")).toBeUndefined();
    expect(store.getInvoice("inv-sound-0")?.workTitle).toBe("Sound 0");
  });

  it("amount and field edges: commas parse, decimals and unsafe numbers fail, caps hold", () => {
    expect(parseAmountInput("1,250")).toBe(1250);
    expect(parseAmountInput(" 2 500 ")).toBe(2500);
    const bad = ["0", "-5", "12.5", "abc", "9007199254740993", ""];
    for (const text of bad) {
      expect(
        validateInvoiceInput({
          workTitle: "Work",
          amount: parseAmountInput(text),
          clientMark: "A",
        }),
      ).not.toBeNull();
    }
    expect(
      validateInvoiceInput({
        workTitle: "x".repeat(120),
        amount: 5,
        clientMark: "y".repeat(80),
      }),
    ).toBeNull();
    expect(
      validateInvoiceInput({
        workTitle: "x".repeat(121),
        amount: 5,
        clientMark: "A",
      })?.field,
    ).toBe("workTitle");
    expect(() =>
      createInvoice({ workTitle: "Work", amount: 1.5, clientMark: "A" }),
    ).toThrow();
  });

  it("200-bill payment check: only the exact matching bill is marked, wrong amounts mark nothing", () => {
    const store = createStore(memoryStorage());
    const bills = Array.from({ length: 200 }, (_, i) =>
      store.addInvoice({
        workTitle: `Bill ${i}`,
        amount: 100 + i,
        clientMark: "A",
      }),
    );
    bills.forEach((bill, i) =>
      store.markInvoiceOnChain(bill.id, {
        workerAddress: worker(3),
        billId: i + 1,
      }),
    );
    // Odd bills paid; one view lies about its amount.
    for (let i = 0; i < 200; i += 1) {
      if (i % 2 === 1) {
        store.markInvoicePaidOnNetwork(bills[i].id, i === 99 ? 1 : 100 + i);
      }
    }
    const paid = store.invoices.filter((bill) => bill.state === "paid");
    expect(paid).toHaveLength(99);
    expect(store.getInvoice(bills[99].id)?.state).toBe("unpaid");
    expect(
      paid.every((bill) => bill.paidOnNetwork && bill.paidOn === null),
    ).toBe(true);
  });
});
