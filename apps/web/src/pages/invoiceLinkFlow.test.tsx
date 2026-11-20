// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const chain = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
});

vi.mock("../chain/session", () => ({
  reserveInvoiceBillIdLive: async () => ({
    billId: 7,
    workerAddress: `0x${"a".repeat(64)}`,
  }),
  createInvoiceLive: async () => {
    await chain.promise;
    return { billId: 7, workerAddress: `0x${"a".repeat(64)}` };
  },
  hasChainSession: () => true,
}));

import Invoice from "./Invoice";
import { createStore } from "../domain/store";
import { decodePayLink } from "../domain/payLink";

afterEach(cleanup);

describe("invoice page network link", () => {
  it("shows no send link until the network write has finished", async () => {
    const store = createStore(null);
    render(<Invoice store={store} />);

    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Trial work" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Client name or mark"), {
      target: { value: "aryan" },
    });

    const button = screen.getByRole("button", { name: "Make invoice" });
    fireEvent.click(button);

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/#\/pay\//)).toBeNull();

    chain.resolve();
    const shown = await screen.findByText(/#\/pay\/p\./);
    const segment = shown.textContent?.replace("#/pay/", "") ?? "";
    const decoded = decodePayLink(segment);
    expect(decoded?.workerAddress).toBe(`0x${"a".repeat(64)}`);
    expect(decoded?.billId).toBe(7);
    expect(store.invoices[0]?.chainBillId).toBe(7);
  });
});
