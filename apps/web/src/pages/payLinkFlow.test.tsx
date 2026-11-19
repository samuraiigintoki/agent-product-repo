// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import { createStore } from "../domain/store";
import { encodePayLink } from "../domain/payLink";

afterEach(cleanup);

describe("pay link opened on a fresh device", () => {
  it("shows the bill, pays it, and thanks the client", () => {
    const worker = createStore();
    const invoice = worker.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const link = encodePayLink(invoice);

    const phone = createStore();
    window.location.hash = `#/pay/${link}`;
    render(<App store={phone} />);
    expect(screen.getByText("Logo design")).toBeTruthy();
    expect(screen.getByText(/1250/)).toBeTruthy();
    expect(screen.queryByText(/Client A/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pay this bill" }));
    expect(screen.getByText(/Paid\. Thank you/)).toBeTruthy();
    expect(phone.getInvoice(invoice.id)?.state).toBe("paid");
  });

  it("a version 2 link shows who will be paid, in short form", () => {
    const worker = createStore();
    const invoice = worker.addInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    const link = encodePayLink(invoice, {
      workerAddress: `0x${"a".repeat(64)}`,
      billId: 42,
    });
    window.location.hash = `#/pay/${link}`;
    render(<App store={createStore()} />);
    expect(screen.getByText(/Pays to wallet: 0xaaaaaa\.\.\./)).toBeTruthy();
    expect(screen.queryByText(/Client A/)).toBeNull();
  });

  it("a garbled pay link fails in plain words", () => {
    window.location.hash = "#/pay/p.!!!";
    render(<App store={createStore()} />);
    expect(screen.getByText(/does not work/)).toBeTruthy();
  });
});
