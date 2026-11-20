// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import CheckProof from "./CheckProof";
import { createStore, sixMonthsFrom, today, type BillStorage } from "../domain/store";
import { buildClaimForBill } from "../chain/proofChain";

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

describe("proof check words", () => {
  it("does not call a self made claim valid on words alone", () => {
    const store = createStore(memoryStorage());
    const invoice = store.addInvoice({
      workTitle: "Self made",
      amount: 500,
      clientMark: "me",
    });
    store.payInvoice(invoice.id, "2026-11-19");
    const claim = buildClaimForBill(
      store.getInvoice(invoice.id)!,
      true,
      sixMonthsFrom(today()),
    );
    const payload = btoa(
      encodeURIComponent(JSON.stringify({ claim, billId: 123 })),
    );

    render(<CheckProof store={createStore(memoryStorage())} id={`p.${payload}`} />);
    expect(screen.queryByText("Valid")).toBeNull();
    expect(screen.getByText("Words match only")).toBeTruthy();
  });
});
