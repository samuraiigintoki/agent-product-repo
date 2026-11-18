import { useState } from "react";
import type { Store } from "../domain/store";

export default function Pay({ store, id }: { store: Store; id: string }) {
  const [, setPaidTick] = useState(0);
  const invoice = store.getInvoice(id);

  if (!invoice) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28 }}>This bill link does not work.</h1>
        <p style={{ fontSize: 18 }}>Ask the worker to send the link again.</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>Pay this bill</h1>
      <p style={{ fontSize: 22 }}>{invoice.workTitle}</p>
      <p style={{ fontSize: 22 }}>Amount: {invoice.amount}</p>
      <p style={{ fontSize: 18 }}>For: {invoice.clientMark}</p>
      <p>Fake test money only. This pay step is private in the real build.</p>
      {invoice.state === "paid" ? (
        <p style={{ fontSize: 22 }}>Paid. Thank you.</p>
      ) : (
        <button
          style={{ fontSize: 20, padding: 14 }}
          onClick={() => {
            store.payInvoice(invoice.id);
            setPaidTick((tick) => tick + 1);
          }}
        >
          Pay this bill
        </button>
      )}
    </main>
  );
}
