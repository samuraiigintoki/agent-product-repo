import { useRef, useState } from "react";
import type { Store } from "../domain/store";
import { sixMonthsFrom, today } from "../domain/store";
import { billIdFor, connectedUserRole, hasChainSession } from "../chain/session";
import RoleBoundary from "./RoleBoundary";
import { buildClaimForBill } from "../chain/proofChain";

export default function MakeProof({ store }: { store: Store }) {
  const [showAmount, setShowAmount] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const makingRef = useRef(false);
  const paidInvoices = store.invoices.filter(
    (invoice) =>
      invoice.state === "paid" && (invoice.side ?? "made") === "made",
  );

  const makeProof = async (invoiceId: string) => {
    if (makingRef.current) {
      return;
    }
    const invoice = store.getInvoice(invoiceId);
    if (!invoice) {
      return;
    }
    makingRef.current = true;
    setMaking(true);
    try {
      store.addClaim(invoice.id, showAmount);
      const claim = buildClaimForBill(invoice, showAmount, sixMonthsFrom(today()));
      const billId = invoice.chainBillId ?? billIdFor(invoice.id);
      const payload = btoa(
        encodeURIComponent(JSON.stringify({ claim, billId })),
      );
      const checkLink = `#/check/p.${payload}`;
      if (!hasChainSession()) {
        setNote(
          "This proof is sealed on this device only. Its network mark was not written.",
        );
        setLink(checkLink);
        return;
      }
      setNote("Writing the proof mark on the network. This can take a few seconds.");
      try {
        const { markProofOnChain } = await import("../chain/proofChain");
        const { currentSessionForProof } = await import("../chain/session");
        const liveSession = await currentSessionForProof();
        if (!liveSession) {
          setLink(null);
          setNote(
            "Connect your wallet as worker to write the proof mark. No proof link was made.",
          );
          return;
        }
        await markProofOnChain(liveSession, claim, billId);
        setNote("Proof mark is on the network. Only a hash and the expiry went public.");
        setLink(checkLink);
      } catch {
        setLink(null);
        setNote("The proof was made here, but the network mark did not finish. No proof link was made.");
      }
    } finally {
      makingRef.current = false;
      setMaking(false);
    }
  };

  if (connectedUserRole() === "client") {
    return <RoleBoundary needed="worker" />;
  }

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
            <p style={{ fontSize: 18, margin: "4px 0" }}>
              {invoice.paidOn
                ? `Paid in full on ${invoice.paidOn}.`
                : invoice.paidOnNetwork
                  ? "Paid in full on the network."
                  : "Paid in full."}
            </p>
            <button
              style={{ fontSize: 18, padding: 12 }}
              disabled={making}
              onClick={() => makeProof(invoice.id)}
            >
              Make proof
            </button>
          </div>
        ))}
      </div>
      {note !== null && <p style={{ fontSize: 18 }}>{note}</p>}
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
