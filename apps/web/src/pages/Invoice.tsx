import { useState } from "react";
import type { Store } from "../domain/store";

export default function Invoice({ store }: { store: Store }) {
  const [workTitle, setWorkTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [clientMark, setClientMark] = useState("");
  const [link, setLink] = useState<string | null>(null);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>New invoice</h1>
      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
          Work title
          <input
            style={{ fontSize: 18, padding: 8 }}
            value={workTitle}
            onChange={(event) => setWorkTitle(event.target.value)}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
          Amount
          <input
            style={{ fontSize: 18, padding: 8 }}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
          Client name or mark
          <input
            style={{ fontSize: 18, padding: 8 }}
            value={clientMark}
            onChange={(event) => setClientMark(event.target.value)}
          />
        </label>
        <button
          style={{ fontSize: 20, padding: 14 }}
          onClick={() => {
            const invoice = store.addInvoice({
              workTitle,
              amount: Number(amount),
              clientMark,
            });
            setLink(`#/pay/${invoice.id}`);
          }}
        >
          Make invoice
        </button>
      </div>
      {link !== null && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 18 }}>Send this link to your client:</p>
          <p style={{ fontSize: 18, wordBreak: "break-all" }}>{link}</p>
          <button
            style={{ fontSize: 18, padding: 12 }}
            onClick={() => {
              window.location.hash = link;
            }}
          >
            Open pay page
          </button>
        </div>
      )}
    </main>
  );
}
