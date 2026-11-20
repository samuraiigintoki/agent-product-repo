// @vitest-environment jsdom
// Worker pages keep a client session out. The boundary
// screen replaces the page body, so no bill form, bill
// list, or proof control is ever drawn for the wrong role.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const chain = vi.hoisted(() => ({
  role: "client" as "worker" | "client" | null,
}));

vi.mock("../chain/session", () => ({
  hasChainSession: () => chain.role !== null,
  connectedUserRole: () => chain.role,
  connectedAccountAddress: () => (chain.role ? `0x${"a".repeat(64)}` : null),
  dropChainSession: async () => {
    chain.role = null;
  },
  signInWithUserWallet: async (role: "worker" | "client") => {
    chain.role = role;
  },
  reserveInvoiceBillIdLive: async () => ({
    billId: 7,
    workerAddress: `0x${"a".repeat(64)}`,
  }),
  createInvoiceLive: async () => ({
    billId: 7,
    workerAddress: `0x${"a".repeat(64)}`,
  }),
  billIdFor: () => 1,
  checkInvoicePaidLive: async () => false,
  payInvoiceLive: async () => ({ seconds: 1 }),
}));

import Invoice from "./Invoice";
import MyPay from "./MyPay";
import MakeProof from "./MakeProof";
import { createStore } from "../domain/store";

afterEach(cleanup);

describe("worker pages with a client session", () => {
  it("the invoice page shows the boundary and no form", () => {
    chain.role = "client";
    render(<Invoice store={createStore(null)} />);
    expect(screen.getByText(/connected to pay bills/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Switch to making bills" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Make invoice" })).toBeNull();
    expect(screen.queryByLabelText("Work title")).toBeNull();
  });

  it("My pay shows the boundary and no bills", () => {
    chain.role = "client";
    const store = createStore(null);
    store.addInvoice({ workTitle: "Mine", amount: 100, clientMark: "A" });
    render(<MyPay store={store} />);
    expect(screen.getByText(/connected to pay bills/)).toBeTruthy();
    expect(screen.queryByText("Mine")).toBeNull();
  });

  it("Make proof shows the boundary and no proof controls", () => {
    chain.role = "client";
    const store = createStore(null);
    const bill = store.addInvoice({
      workTitle: "Paid work",
      amount: 100,
      clientMark: "A",
    });
    store.payInvoice(bill.id);
    render(<MakeProof store={store} />);
    expect(screen.getByText(/connected to pay bills/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Make proof" })).toBeNull();
  });

  it("My pay offers a copy link, never open pay page", () => {
    chain.role = "worker";
    const store = createStore(null);
    const bill = store.addInvoice({
      workTitle: "Network work",
      amount: 100,
      clientMark: "A",
    });
    store.markInvoiceOnChain(bill.id, {
      workerAddress: `0x${"a".repeat(64)}`,
      billId: 42,
    });
    render(<MyPay store={store} />);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.queryByText("Open pay page")).toBeNull();
  });

  it("the invoice result offers a copy link, never open pay page", async () => {
    chain.role = "worker";
    const store = createStore(null);
    render(<Invoice store={store} />);
    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Network work" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Client name or mark"), {
      target: { value: "A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make invoice" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Copy link" }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("Open pay page")).toBeNull();
  });

  it("a worker session sees the real invoice form", () => {
    chain.role = "worker";
    render(<Invoice store={createStore(null)} />);
    expect(screen.getByRole("button", { name: "Make invoice" })).toBeTruthy();
  });
});
