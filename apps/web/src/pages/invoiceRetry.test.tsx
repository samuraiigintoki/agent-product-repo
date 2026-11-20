// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const chain = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../chain/session", () => ({
  reserveInvoiceBillIdLive: async () => ({
    billId: 7,
    workerAddress: `0x${"a".repeat(64)}`,
  }),
  createInvoiceLive: async () => {
    chain.calls += 1;
    if (chain.calls === 1) {
      throw new Error("network write failed");
    }
    return { billId: 7, workerAddress: `0x${"a".repeat(64)}` };
  },
  hasChainSession: () => true,
  connectedUserRole: () => "worker",
}));

import Invoice from "./Invoice";
import { createStore } from "../domain/store";

afterEach(cleanup);

describe("invoice network retry", () => {
  it("retries the same saved bill after a failed write", async () => {
    chain.calls = 0;
    const store = createStore(null);
    render(<Invoice store={store} />);
    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Trial work" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make invoice" }));

    const retry = await screen.findByRole("button", {
      name: "Write this bill on the network",
    });
    expect(store.invoices).toHaveLength(1);
    expect(store.invoices[0]?.chainAttemptBillId).toBe(7);
    expect(store.invoices[0]?.chainBillId).toBeUndefined();

    fireEvent.click(retry);
    expect(await screen.findByText(/#\/pay\/p\./)).toBeTruthy();
    expect(store.invoices).toHaveLength(1);
    expect(store.invoices[0]?.chainBillId).toBe(7);
    expect(chain.calls).toBe(2);
  });
});
