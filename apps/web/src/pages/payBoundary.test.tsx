// @vitest-environment jsdom
// The pay page keeps the two roles apart. A worker never
// sees a working pay form, a wallet never pays its own
// bill, and a network link with no session offers a way
// home instead of a pay button.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const chain = vi.hoisted(() => ({
  role: null as "worker" | "client" | null,
  account: `0x${"a".repeat(64)}`,
}));

vi.mock("../chain/session", () => ({
  hasChainSession: () => chain.role !== null,
  connectedUserRole: () => chain.role,
  connectedAccountAddress: () => (chain.role ? chain.account : null),
  dropChainSession: async () => {
    chain.role = null;
  },
  signInWithUserWallet: async (role: "worker" | "client") => {
    chain.role = role;
  },
  checkInvoicePaidLive: async () => false,
  payInvoiceLive: async () => ({ seconds: 1 }),
}));

import Pay from "./Pay";
import { createStore, type BillStorage } from "../domain/store";
import { encodePayLink } from "../domain/payLink";

afterEach(cleanup);

const OWN = `0x${"a".repeat(64)}`;
const OTHER = `0x${"0".repeat(60)}babe`;

function memoryStorage(): BillStorage {
  const raw = new Map<string, string>();
  return {
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

function renderPay(linkWorker: string) {
  const maker = createStore(memoryStorage());
  const bill = maker.addInvoice({
    workTitle: "Trial work",
    amount: 500,
    clientMark: "aryan",
  });
  const segment = encodePayLink(bill, { workerAddress: linkWorker, billId: 2 });
  const store = createStore(memoryStorage());
  render(<Pay store={store} id={segment} />);
  return { store, bill };
}

describe("pay page role boundary", () => {
  it("shows the worker their own bill link, with no pay form", () => {
    chain.role = "worker";
    chain.account = OWN;
    renderPay(OWN);
    expect(screen.getByText("This is your bill link")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open My pay" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
  });

  it("copy link tells the person when the copy did not run", async () => {
    chain.role = "worker";
    chain.account = OWN;
    renderPay(OWN);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    // jsdom has no clipboard, so the honest fallback words show.
    expect(await screen.findByText(/Copy the link above by hand/)).toBeTruthy();
  });

  it("shows another worker's link as a boundary, and switching reveals the pay form", async () => {
    chain.role = "worker";
    chain.account = OWN;
    renderPay(OTHER);
    expect(screen.getByText(/connected to make bills/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to paying bills" }),
    );
    expect(
      await screen.findByRole("button", { name: "Pay this bill" }),
    ).toBeTruthy();
  });

  it("never lets a client wallet pay its own bill", () => {
    chain.role = "client";
    chain.account = OWN;
    renderPay(OWN);
    expect(screen.getByText(/cannot pay your own bill/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
  });

  it("with no session, a network link offers the way home and no pay button", () => {
    chain.role = null;
    const { store, bill } = renderPay(OTHER);
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Go to the home page" }),
    ).toBeTruthy();
    expect(store.getInvoice(bill.id)?.state).toBe("unpaid");
  });
});
