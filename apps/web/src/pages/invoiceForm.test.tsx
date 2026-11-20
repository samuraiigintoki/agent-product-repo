// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Invoice from "./Invoice";
import { createStore } from "../domain/store";

afterEach(cleanup);

describe("invoice form faults", () => {
  it("shows the field fault and makes no bill", () => {
    const store = createStore(null);
    render(<Invoice store={store} />);
    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Trial work" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1,250.50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Make invoice" }));

    expect(store.invoices).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toMatch(/whole number/);
  });

  it("accepts a comma amount and makes one bill from a double click", () => {
    const store = createStore(null);
    render(<Invoice store={store} />);
    fireEvent.change(screen.getByLabelText("Work title"), {
      target: { value: "Trial work" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1,250" },
    });
    const button = screen.getByRole("button", { name: "Make invoice" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(store.invoices).toHaveLength(1);
    expect(store.invoices[0]?.amount).toBe(1250);
  });
});
