// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../App";
import Pay from "./Pay";
import { createStore, type BillStorage } from "../domain/store";
import { encodePayLink } from "../domain/payLink";

afterEach(cleanup);

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

describe("pay truth without a wallet session", () => {
  it("does not spend the paid mark before a network wallet is connected", () => {
    const worker = createStore(memoryStorage());
    const invoice = worker.addInvoice({
      workTitle: "Trial work",
      amount: 500,
      clientMark: "aryan",
    });
    const link = encodePayLink(invoice, {
      workerAddress: `0x${"a".repeat(64)}`,
      billId: 2,
    });

    const client = createStore(memoryStorage());
    window.location.hash = `#/pay/${link}`;
    render(<App store={client} />);

    // No pay button is offered before a client wallet is
    // connected, so the paid mark cannot be spent here.
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Go to the home page" }),
    ).toBeTruthy();
    expect(client.getInvoice(invoice.id)?.state).toBe("unpaid");
    expect(screen.queryByText(/Paid\\. Thank you/)).toBeNull();
    expect(screen.getByText(/Connect your wallet as client/)).toBeTruthy();
  });

  it("stops when a link clashes with a bill already on this device", () => {
    const worker = createStore(memoryStorage());
    const real = worker.addInvoice({
      workTitle: "Real work",
      amount: 500,
      clientMark: "A",
    });
    const segment = encodePayLink(real, {
      workerAddress: `0x${"a".repeat(64)}`,
      billId: 4,
    });

    const client = createStore(memoryStorage());
    client.importInvoice({
      id: real.id,
      workTitle: "Fake work",
      amount: 1,
      workerAddress: `0x${"b".repeat(64)}`,
      billId: 9,
    });

    render(<Pay store={client} id={segment} />);
    expect(screen.getByRole("heading", { name: /clashes/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay this bill" })).toBeNull();
    expect(client.getInvoice(real.id)?.amount).toBe(1);
  });
});
