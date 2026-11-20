// @vitest-environment jsdom
// Brutal campaign, page level. The network send is mocked;
// page and store truth are real. Local only: this proves
// nothing about live scale.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const chain = vi.hoisted(() => ({
  session: true,
  paidOnChain: false,
  payCalls: 0,
  payBehavior: "ok" as "ok" | "role" | "lost",
  createCalls: 0,
  createFails: false,
  invoiceRoleWrong: false,
  proofResult: null as "valid" | "broken" | null,
  role: "worker" as "worker" | "client",
}));

vi.mock("../chain/session", () => ({
  hasChainSession: () => chain.session,
  connectedUserRole: () => (chain.session ? chain.role : null),
  connectedAccountAddress: () =>
    chain.session ? `0x${"0".repeat(60)}babe` : null,
  dropChainSession: async () => {},
  signInWithUserWallet: async () => {},
  checkInvoicePaidLive: async () => chain.paidOnChain,
  payInvoiceLive: async () => {
    chain.payCalls += 1;
    await new Promise((done) => setTimeout(done, 30));
    if (chain.payBehavior === "role") {
      throw new Error(
        "This wallet is connected to make bills. Connect as client to pay.",
      );
    }
    chain.paidOnChain = true;
    if (chain.payBehavior === "lost") {
      throw new Error("reply lost");
    }
    return { seconds: 3 };
  },
  reserveInvoiceBillIdLive: async () => {
    if (chain.invoiceRoleWrong) {
      throw new Error(
        "This wallet is connected to pay bills. Connect as worker to make bills.",
      );
    }
    return { billId: 7, workerAddress: `0x${"a".repeat(64)}` };
  },
  createInvoiceLive: async () => {
    chain.createCalls += 1;
    if (chain.createFails) {
      throw new Error("network write failed");
    }
    return { billId: 7, workerAddress: `0x${"a".repeat(64)}` };
  },
  checkMarkedProofLive: async () => chain.proofResult,
}));

import Pay from "./Pay";
import Invoice from "./Invoice";
import MyPay from "./MyPay";
import CheckProof from "./CheckProof";
import { createStore, type BillStorage } from "../domain/store";
import { encodePayLink } from "../domain/payLink";

afterEach(cleanup);

const WORKER_A = `0x${"a".repeat(64)}`;
const WORKER_B = `0x${"b".repeat(64)}`;

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

function resetChain() {
  chain.session = true;
  chain.paidOnChain = false;
  chain.payCalls = 0;
  chain.payBehavior = "ok";
  chain.createCalls = 0;
  chain.createFails = false;
  chain.invoiceRoleWrong = false;
  chain.proofResult = null;
  chain.role = "worker";
}

function makeLink(store: ReturnType<typeof createStore>) {
  const bill = store.addInvoice({
    workTitle: "Trial work",
    amount: 500,
    clientMark: "aryan",
  });
  return { bill, segment: encodePayLink(bill, { workerAddress: WORKER_A, billId: 2 }) };
}

describe("brutal campaign: pages under attack", () => {
  it("double click pays once; a device-only mark does not block the later network pay", async () => {
    resetChain();
    const workerStore = createStore(memoryStorage());
    const { bill, segment } = makeLink(workerStore);
    const client = createStore(memoryStorage());
    client.importInvoice({
      id: bill.id,
      workTitle: bill.workTitle,
      amount: 500,
      workerAddress: WORKER_A,
      billId: 2,
    });
    // An old device-only mark from before the fix.
    client.payInvoice(bill.id, "2026-11-19");
    expect(client.getInvoice(bill.id)?.paidOnNetwork).toBeFalsy();

    chain.role = "client";
    render(<Pay store={client} id={segment} />);
    expect(screen.getByText(/marked paid on this device only/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Pay this bill" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByText(/Paid on the network/)).toBeTruthy();
    expect(chain.payCalls).toBe(1);
    expect(client.getInvoice(bill.id)?.paidOnNetwork).toBe(true);
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
  });

  it("lost pay reply: rechecks the network before calling the bill unpaid", async () => {
    resetChain();
    chain.payBehavior = "lost";
    const workerStore = createStore(memoryStorage());
    const { bill, segment } = makeLink(workerStore);
    const client = createStore(memoryStorage());
    chain.role = "client";
    render(<Pay store={client} id={segment} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(await screen.findByText(/already paid on the network/)).toBeTruthy();
    expect(client.getInvoice(bill.id)?.paidOnNetwork).toBe(true);
  });

  it("wrong role reaches the person on both the pay and invoice pages", async () => {
    resetChain();
    // A network link opened while the wallet is connected as
    // the worker shows the boundary screen at once. The pay
    // form is never drawn, so no click is needed to be
    // stopped. The session layer refuses the call too.
    const workerStore = createStore(memoryStorage());
    const { segment } = makeLink(workerStore);
    render(<Pay store={createStore(memoryStorage())} id={segment} />);
    expect(screen.getByText(/connected to make bills/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Switch to paying bills" }),
    ).toBeTruthy();
    expect(chain.payCalls).toBe(0);
    cleanup();

    // The invoice page with a client session shows its
    // boundary before any form field exists.
    chain.role = "client";
    const store = createStore(memoryStorage());
    render(<Invoice store={store} />);
    expect(screen.getByText(/connected to pay bills/)).toBeTruthy();
    expect(screen.queryByLabelText("Work title")).toBeNull();
    expect(screen.queryByText(/#\/pay\//)).toBeNull();
  });

  it("refresh during write: the reserved bill number survives and the retry reuses it", async () => {
    resetChain();
    chain.createFails = true;
    const storage = memoryStorage();
    const store = createStore(storage);
    render(<Invoice store={store} />);
    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Cut off work" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "900" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make invoice" }));
    await screen.findByRole("button", {
      name: "Write this bill on the network",
    });
    cleanup();

    // A fresh store on the same storage stands in for the
    // page after a refresh or a crash mid-write.
    const after = createStore(storage);
    expect(after.invoices).toHaveLength(1);
    expect(after.invoices[0].chainAttemptBillId).toBe(7);
    expect(after.invoices[0].chainBillId).toBeUndefined();

    chain.createFails = false;
    render(
      <MyPay
        store={after}
        writeLive={async (bill) => ({
          billId: bill.chainAttemptBillId ?? 99,
          workerAddress: WORKER_A,
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Write this bill on the network" }),
    );
    expect(await screen.findByText(/link is ready below/)).toBeTruthy();
    expect(after.invoices).toHaveLength(1);
    expect(after.invoices[0].chainBillId).toBe(7);
  });

  it("My pay checks 200 bills: half paid, every mark tied to its own bill", async () => {
    resetChain();
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
        workerAddress: WORKER_A,
        billId: i + 1,
      }),
    );
    const start = Date.now();
    render(
      <MyPay
        store={store}
        currentWorkerAddress={WORKER_A}
        readPaymentsLive={async () =>
          bills.map((bill, i) => ({
            invoiceId: bill.id,
            billId: i + 1,
            amount: 100 + i,
            paid: i % 2 === 0,
          }))
        }
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Read my pay from the network" }),
    );
    expect(await screen.findByText(/Checked 200 bills/)).toBeTruthy();
    expect(screen.getByText(/100 paid/)).toBeTruthy();
    expect(store.invoices.filter((bill) => bill.state === "paid")).toHaveLength(100);
    expect(
      store.invoices.every(
        (bill, i) => bill.state !== "paid" || i % 2 === 0,
      ),
    ).toBe(true);
    console.log(`BRUTAL My pay 200-bill check rendered in ${Date.now() - start}ms`);
  });

  it("My pay hides another wallet's network bills and never writes over them", async () => {
    const store = createStore(memoryStorage());
    const mine = store.addInvoice({ workTitle: "Mine", amount: 100, clientMark: "A" });
    const theirs = store.addInvoice({ workTitle: "Theirs", amount: 200, clientMark: "B" });
    store.markInvoiceOnChain(theirs.id, { workerAddress: WORKER_B, billId: 5 });

    render(
      <MyPay
        store={store}
        currentWorkerAddress={WORKER_A}
        writeLive={async () => ({ billId: 1, workerAddress: WORKER_A })}
      />,
    );
    expect(screen.getByText("Mine")).toBeTruthy();
    expect(screen.queryByText("Theirs")).toBeNull();
    expect(store.getInvoice(mine.id)).toBeTruthy();
  });

  it("proof check pack: malformed, tampered, and expired proofs never show Valid", () => {
    resetChain();
    const store = createStore(memoryStorage());
    const bill = store.addInvoice({
      workTitle: "Proof work",
      amount: 500,
      clientMark: "A",
    });
    store.payInvoice(bill.id, "2026-11-19");
    const stored = store.addClaim(bill.id, true)!;
    const seg = (value: unknown) =>
      `p.${btoa(encodeURIComponent(JSON.stringify(value)))}`;
    const cases: unknown[] = [
      { claim: { ...stored.claim, seal: "deadbeef" }, billId: 1 },
      { claim: { ...stored.claim, amount: "500" }, billId: 1 },
      { claim: { ...stored.claim, expiresAt: "2020-01-01" }, billId: 1 },
      { claim: null, billId: 1 },
      { claim: stored.claim, billId: 0 },
      { claim: stored.claim, billId: -2 },
      { claim: { invoiceId: 42 }, billId: 1 },
      "junk",
      null,
    ];
    for (const item of cases) {
      render(<CheckProof store={store} id={seg(item)} />);
      expect(screen.queryByText("Valid")).toBeNull();
      cleanup();
    }
    // A sound claim with no network check is words only.
    render(
      <CheckProof store={store} id={seg({ claim: stored.claim, billId: 1 })} />,
    );
    expect(screen.getByText("Words match only")).toBeTruthy();
    expect(screen.queryByText("Valid")).toBeNull();
  });

  it("a dateless device-paid bill is never called network paid on My pay or Make proof lists", () => {
    const store = createStore(memoryStorage());
    const bill = store.addInvoice({
      workTitle: "Legacy paid",
      amount: 100,
      clientMark: "A",
    });
    // A paid record with no date and no network flag, as an
    // old or hand-carried record could hold.
    store.markInvoicePaidOnNetwork(bill.id, 999);
    expect(store.getInvoice(bill.id)?.state).toBe("unpaid");
    render(<MyPay store={store} />);
    expect(screen.getByText("Not paid yet.")).toBeTruthy();
    expect(screen.queryByText(/Paid in full on the network/)).toBeNull();
  });
});
