import { useState } from "react";
import type { Store } from "../domain/store";
import type { ReceiptView } from "../chain/invoiceChain";

export default function MyPay({
  store,
  readLive,
}: {
  store: Store;
  readLive?: () => Promise<ReceiptView | null>;
}) {
  const [live, setLive] = useState<ReceiptView | null>(null);
  const [liveState, setLiveState] = useState<"idle" | "reading" | "done" | "off">(
    "idle",
  );

  const read = async () => {
    if (!readLive) {
      return;
    }
    setLiveState("reading");
    const view = await readLive();
    if (view === null) {
      setLiveState("off");
      return;
    }
    setLive(view);
    setLiveState("done");
  };

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>My pay</h1>
      {store.invoices.length === 0 && (
        <p style={{ fontSize: 18 }}>No bills yet. Make your first invoice from the home page.</p>
      )}
      <div style={{ display: "grid", gap: 16 }}>
        {store.invoices.map((invoice) => (
          <div key={invoice.id} style={{ border: "1px solid #999", padding: 12 }}>
            <p style={{ fontSize: 20, margin: "4px 0" }}>{invoice.workTitle}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>Amount: {invoice.amount}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>Client: {invoice.clientMark}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>
              {invoice.state === "paid"
                ? `Paid in full on ${invoice.paidOn}.`
                : "Not paid yet."}
            </p>
          </div>
        ))}
      </div>
      {readLive && (
        <div style={{ marginTop: 32, border: "1px solid #999", padding: 16 }}>
          <p style={{ fontSize: 20, margin: "4px 0" }}>Live local network</p>
          <button style={{ fontSize: 18, padding: 12 }} onClick={read}>
            Read my pay from the local network
          </button>
          {liveState === "reading" && (
            <p style={{ fontSize: 18 }}>
              Reading in private. This can take a few seconds.
            </p>
          )}
          {liveState === "off" && (
            <p style={{ fontSize: 18 }}>
              No one is signed in. Sign in on the home page first.
            </p>
          )}
          {liveState === "done" && live !== null && live.count === 0 && (
            <p style={{ fontSize: 18 }}>
              This account has no pay records on the local network. If you
              signed in with the wrong test account, that is why nothing
              shows here.
            </p>
          )}
          {liveState === "done" && live !== null && live.count > 0 && (
            <p style={{ fontSize: 18 }}>
              Bill {live.billId}: paid in full, amount {live.amount}. Receipt
              read from the local network.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
