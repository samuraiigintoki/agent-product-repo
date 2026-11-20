// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const chain = vi.hoisted(() => ({
  behavior: "role" as "role" | "down" | "landed" | "ok",
  checks: 0,
}));

vi.mock("../chain/session", () => ({
  hasChainSession: () => true,
  checkInvoicePaidLive: async () => {
    chain.checks += 1;
    return chain.behavior === "landed" && chain.checks > 1;
  },
  payInvoiceLive: async () => {
    if (chain.behavior === "role") {
      throw new Error(
        "This wallet is connected to make bills. Connect as client to pay.",
      );
    }
    if (chain.behavior === "down" || chain.behavior === "landed") {
      throw new Error("reply lost");
    }
    return { seconds: 3 };
  },
}));

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

function renderPay() {
  chain.checks = 0;
  const worker = createStore(memoryStorage());
  const invoice = worker.addInvoice({
    workTitle: "Trial work",
    amount: 500,
    clientMark: "aryan",
  });
  const segment = encodePayLink(invoice, {
    workerAddress: `0x${"a".repeat(64)}`,
    billId: 2,
  });
  const client = createStore(memoryStorage());
  render(<Pay store={client} id={segment} />);
  return { client, invoice };
}

describe("pay truth with a live session", () => {
  it("tells the person the wallet is in the wrong role", async () => {
    chain.behavior = "role";
    const { client, invoice } = renderPay();
    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(
      await screen.findByText(/connected to make bills/),
    ).toBeTruthy();
    expect(client.getInvoice(invoice.id)?.state).toBe("unpaid");
  });

  it("keeps the bill unpaid when the network pay fails", async () => {
    chain.behavior = "down";
    const { client, invoice } = renderPay();
    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(await screen.findByText(/did not finish/)).toBeTruthy();
    expect(client.getInvoice(invoice.id)?.state).toBe("unpaid");
  });

  it("marks paid when a lost reply had in fact landed", async () => {
    chain.behavior = "landed";
    const { client, invoice } = renderPay();
    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(await screen.findByText(/already paid on the network/)).toBeTruthy();
    expect(client.getInvoice(invoice.id)?.state).toBe("paid");
  });

  it("marks paid only after the network pay lands", async () => {
    chain.behavior = "ok";
    const { client, invoice } = renderPay();
    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(await screen.findByText(/Paid on the network/)).toBeTruthy();
    expect(client.getInvoice(invoice.id)?.state).toBe("paid");
  });
});
