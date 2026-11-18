import { useState } from "react";
import type { Store } from "../domain/store";

export default function MakeProof({ store }: { store: Store }) {
  const [showAmount, setShowAmount] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const paidInvoices = store.invoices.filter((invoice) => invoice.state === "paid");

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>Make proof</h1>
      <p style={{ fontSize: 18 }}>
        A proof says one bill was paid in full. It does not show your
        other pay or who paid you.
      </p>
      {paidInvoices.length === 0 && (
        <p style={{ fontSize: 18 }}>No paid bills yet. A proof can only be made after a bill is paid.</p>
      )}
      <label style={{ display: "flex", gap: 8, fontSize: 18, margin: "16px 0" }}>
        <input
          type="checkbox"
          checked={showAmount}
          onChange={(event) => setShowAmount(event.target.checked)}
        />
        Show the amount on the proof (off is the safe start)
      </label>
      <div style={{ display: "grid", gap: 16 }}>
        {paidInvoices.map((invoice) => (
          <div key={invoice.id} style={{ border: "1px solid #999", padding: 12 }}>
            <p style={{ fontSize: 20, margin: "4px 0" }}>{invoice.workTitle}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>Paid in full on {invoice.paidOn}.</p>
            <button
              style={{ fontSize: 18, padding: 12 }}
              onClick={() => {
                const stored = store.addClaim(invoice.id, showAmount);
                if (stored) {
                  setLink(`#/check/${stored.id}`);
                }
              }}
            >
              Make proof
            </button>
          </div>
        ))}
      </div>
      {link !== null && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 18 }}>Send this check link to the person who asked:</p>
          <p style={{ fontSize: 18, wordBreak: "break-all" }}>{link}</p>
          <button
            style={{ fontSize: 18, padding: 12 }}
            onClick={() => {
              window.location.hash = link;
            }}
          >
            Open check page
          </button>
        </div>
      )}
    </main>
  );
}
