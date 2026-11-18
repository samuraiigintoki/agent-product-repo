import { useState } from "react";
import { createInvoiceLive, hasChainSession } from "../chain/session";
import type { Store } from "../domain/store";
import {
  parseAmountInput,
  validateInvoiceInput,
  type InvoiceInputIssue,
} from "../domain/invoice";
import { encodePayLink } from "../domain/payLink";

export default function Invoice({ store }: { store: Store }) {
  const [workTitle, setWorkTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [clientMark, setClientMark] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [chainNote, setChainNote] = useState<string | null>(null);
  const [issue, setIssue] = useState<InvoiceInputIssue | null>(null);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>New invoice</h1>
      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
          Work title
          <input
            style={{ fontSize: 18, padding: 8 }}
            value={workTitle}
            aria-describedby={issue?.field === "workTitle" ? "workTitle-error" : undefined}
            onChange={(event) => setWorkTitle(event.target.value)}
          />
          {issue?.field === "workTitle" && (
            <span id="workTitle-error" role="alert" style={{ color: "#b00020", fontSize: 16 }}>
              {issue.message}
            </span>
          )}
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
          onClick={async () => {
            const invoice = store.addInvoice({
              workTitle,
              amount: Number(amount),
              clientMark,
            });
            setLink(`#/pay/${encodePayLink(invoice)}`);
            if (hasChainSession()) {
              setChainNote("Writing the bill on the local network. This can take a few seconds.");
              try {
                await createInvoiceLive({
                  webInvoiceId: invoice.id,
                  amount: invoice.amount,
                });
                setChainNote("This bill is also written on the local network.");
              } catch {
                setChainNote("The bill was made here, but the local network write did not finish.");
              }
            }
          }}
        >
          Make invoice
        </button>
      </div>
      {chainNote !== null && <p style={{ fontSize: 18 }}>{chainNote}</p>}
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
