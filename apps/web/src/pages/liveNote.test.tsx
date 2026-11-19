// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);
import MyPay from "./MyPay";
import { createStore } from "../domain/store";

describe("live network read on My pay", () => {
  it("says plainly when this account has no pay on the network", async () => {
    const store = createStore();
    render(
      <MyPay
        store={store}
        readLive={async () => ({
          count: 0,
          billId: 0,
          amount: 0,
          payerMark: 0,
          paidBlock: 0,
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Read my pay from the network" }),
    );
    expect(
      await screen.findByText(/no pay records on the network/),
    ).toBeTruthy();
    expect(screen.getByText(/after a client pays/)).toBeTruthy();
  });

  it("shows a receipt read from the local network", async () => {
    const store = createStore();
    render(
      <MyPay
        store={store}
        readLive={async () => ({
          count: 1,
          billId: 42,
          amount: 1250,
          payerMark: 99,
          paidBlock: 9,
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Read my pay from the network" }),
    );
    expect(await screen.findByText(/Bill 42/)).toBeTruthy();
    expect(screen.getByText(/1250/)).toBeTruthy();
  });
});
