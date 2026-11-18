// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import { createStore } from "../domain/store";

function goTo(hash: string) {
  window.location.hash = hash;
  fireEvent(window, new HashChangeEvent("hashchange"));
}

describe("full click path with fake data", () => {
  it("make invoice, pay it, make proof, check proof with amount hidden", () => {
    const store = createStore();
    window.location.hash = "#/";
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
    fireEvent(window, new HashChangeEvent("hashchange"));
    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Logo design" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1250" },
    });
    fireEvent.change(screen.getByLabelText("Client name or mark"), {
      target: { value: "Client A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make invoice" }));

    const invoice = store.invoices[0];
    expect(invoice.state).toBe("unpaid");
    expect(screen.getByText(/#\/pay\/p\./)).toBeTruthy();

    goTo(`#/pay/${invoice.id}`);
    expect(screen.getByText("Logo design")).toBeTruthy();
    expect(screen.getByText(/1250/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(store.invoices[0].state).toBe("paid");
    expect(screen.getByText(/Paid/)).toBeTruthy();

    goTo("#/proof");
    fireEvent.click(screen.getByRole("button", { name: "Make proof" }));
    const stored = store.claims[0];
    expect(stored.claim.amount).toBeNull();

    goTo(`#/check/${stored.id}`);
    expect(screen.getByText("Valid")).toBeTruthy();
    expect(screen.getByText(/paid in full/)).toBeTruthy();
    expect(screen.queryByText(/1250/)).toBeNull();
  });

  it("my pay page lists a paid bill in plain words", () => {
    const store = createStore();
    const invoice = store.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    store.payInvoice(invoice.id, "2026-11-18");
    window.location.hash = "#/mypay";
    render(<App store={store} />);
    expect(screen.getByText("My pay")).toBeTruthy();
    expect(screen.getByText(/Paid in full on 2026-11-18/)).toBeTruthy();
  });

  it("check page says plainly when the proof link does not work", () => {
    const store = createStore();
    window.location.hash = "#/check/nope";
    render(<App store={store} />);
    expect(screen.getByText(/does not work/)).toBeTruthy();
  });
});
