// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MyPay from "./MyPay";
import { createStore, type BillStorage } from "../domain/store";

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

describe("My pay after the break test fixes", () => {
  it("shows made bills only, not bills sent to this device to pay", () => {
    const store = createStore(memoryStorage());
    store.addInvoice({ workTitle: "Mine", amount: 100, clientMark: "A" });
    store.importInvoice({
      id: "inv-sent",
      workTitle: "Theirs",
      amount: 200,
      workerAddress: `0x${"a".repeat(64)}`,
      billId: 9,
    });

    render(<MyPay store={store} />);
    expect(screen.getByText("Mine")).toBeTruthy();
    expect(screen.queryByText("Theirs")).toBeNull();
  });

  it("ties network payments back to the matching bills", async () => {
    const store = createStore(memoryStorage());
    const one = store.addInvoice({
      workTitle: "One",
      amount: 100,
      clientMark: "A",
    });
    const two = store.addInvoice({
      workTitle: "Two",
      amount: 200,
      clientMark: "B",
    });
    const worker = `0x${"a".repeat(64)}`;
    store.markInvoiceOnChain(one.id, { workerAddress: worker, billId: 1 });
    store.markInvoiceOnChain(two.id, { workerAddress: worker, billId: 2 });

    render(
      <MyPay
        store={store}
        readPaymentsLive={async () => [
          { invoiceId: one.id, billId: 1, amount: 100, paid: false },
          { invoiceId: two.id, billId: 2, amount: 200, paid: true },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Read my pay from the network" }),
    );

    expect(await screen.findByText(/Checked 2 bills/)).toBeTruthy();
    expect(screen.getByText(/Bill 2: paid in full/)).toBeTruthy();
    expect(store.getInvoice(one.id)?.state).toBe("unpaid");
    expect(store.getInvoice(two.id)?.state).toBe("paid");
    expect(store.getInvoice(two.id)?.paidOn).toBeNull();
  });

  it("writes a saved bill on the network from My pay", async () => {
    const store = createStore(memoryStorage());
    const bill = store.addInvoice({
      workTitle: "Late write",
      amount: 300,
      clientMark: "A",
    });

    render(
      <MyPay
        store={store}
        writeLive={async () => ({
          billId: 5,
          workerAddress: `0x${"a".repeat(64)}`,
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Write this bill on the network" }),
    );

    expect(await screen.findByText(/link is ready below/)).toBeTruthy();
    expect(store.getInvoice(bill.id)?.chainBillId).toBe(5);
  });
});
