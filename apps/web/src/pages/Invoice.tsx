import { useRef, useState } from "react";
import {
  connectedUserRole,
  createInvoiceLive,
  hasChainSession,
  reserveInvoiceBillIdLive,
} from "../chain/session";
import RoleBoundary from "./RoleBoundary";
import { copyText } from "./copyText";
import type { Store } from "../domain/store";
import {
  parseAmountInput,
  validateInvoiceInput,
  type Invoice as InvoiceRecord,
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
  const [writing, setWriting] = useState(false);
  const [failedInvoiceId, setFailedInvoiceId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const lastSubmitRef = useRef<{ key: string; at: number } | null>(null);

  const writeOnNetwork = async (invoice: InvoiceRecord) => {
    setWriting(true);
    setChainNote("Writing the bill on the network. This can take a few seconds.");
    // A bill that already holds a reserved number is being
    // retried, and a retry checks the network first. A bill
    // with no number yet is a first send.
    const isRetry = invoice.chainAttemptBillId !== undefined;
    try {
      const attempt =
        invoice.chainAttemptBillId && invoice.chainWorkerAddress
          ? {
              billId: invoice.chainAttemptBillId,
              workerAddress: invoice.chainWorkerAddress,
            }
          : await reserveInvoiceBillIdLive(invoice.id);
      if (!attempt) {
        throw new Error("No network session.");
      }
      // Save the reserved number before the send. If the
      // page closes or the reply is lost, My pay can retry
      // this same bill instead of making a second one.
      store.setInvoiceChainAttempt(invoice.id, attempt);
      const target = await createInvoiceLive({
        webInvoiceId: invoice.id,
        amount: invoice.amount,
        billId: attempt.billId,
        checkExisting: isRetry,
      });
      if (!target) {
        throw new Error("No network session.");
      }
      const marked = store.markInvoiceOnChain(invoice.id, target);
      if (!marked) {
        throw new Error("Network pay target missing.");
      }
      setLink(`#/pay/${encodePayLink(marked, target)}`);
      setFailedInvoiceId(null);
      setChainNote(
        store.saveFailed
          ? "This bill is written on the network, but it could not be saved on this device. Copy the link now."
          : "This bill is written on the network. The link below is ready to send.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setLink(null);
      setFailedInvoiceId(invoice.id);
      setChainNote(
        message.includes("connected to pay bills") ||
          message.includes("connected to make bills") ||
          message.includes("wallet is locked") ||
          message.includes("Unlock your wallet")
          ? message
          : "The bill was made here, but the network write did not finish. Do not send a link for this bill yet.",
      );
    } finally {
      setWriting(false);
    }
  };

  if (connectedUserRole() === "client") {
    return <RoleBoundary needed="worker" />;
  }

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
            aria-describedby={issue?.field === "amount" ? "amount-error" : undefined}
            onChange={(event) => setAmount(event.target.value)}
          />
          {issue?.field === "amount" && (
            <span id="amount-error" role="alert" style={{ color: "#b00020", fontSize: 16 }}>
              {issue.message}
            </span>
          )}
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 18 }}>
          Client name or mark
          <input
            style={{ fontSize: 18, padding: 8 }}
            value={clientMark}
            aria-describedby={issue?.field === "clientMark" ? "clientMark-error" : undefined}
            onChange={(event) => setClientMark(event.target.value)}
          />
          {issue?.field === "clientMark" && (
            <span id="clientMark-error" role="alert" style={{ color: "#b00020", fontSize: 16 }}>
              {issue.message}
            </span>
          )}
        </label>
        <button
          style={{ fontSize: 20, padding: 14 }}
          disabled={writing}
          onClick={async () => {
            if (busyRef.current) {
              return;
            }
            busyRef.current = true;
            try {
              const parsedAmount = parseAmountInput(amount);
              const foundIssue = validateInvoiceInput({
                workTitle,
                amount: parsedAmount,
                clientMark,
              });
              if (foundIssue) {
                setIssue(foundIssue);
                return;
              }
              setIssue(null);
              const submitKey = JSON.stringify([
                workTitle.trim(),
                parsedAmount,
                clientMark.trim(),
              ]);
              const lastSubmit = lastSubmitRef.current;
              if (
                lastSubmit &&
                lastSubmit.key === submitKey &&
                Date.now() - lastSubmit.at < 1000
              ) {
                return;
              }
              lastSubmitRef.current = { key: submitKey, at: Date.now() };
              setLink(null);
              setFailedInvoiceId(null);
              const invoice = store.addInvoice({
                workTitle,
                amount: parsedAmount,
                clientMark,
              });
              if (!hasChainSession()) {
                setLink(`#/pay/${encodePayLink(invoice)}`);
                setChainNote(
                  store.saveFailed
                    ? "This bill could not be saved on this device. Copy the link now."
                    : "This link only marks pay on a device. Connect your wallet to write bills on the network.",
                );
                return;
              }
              // With a live session, no link is shown yet. The
              // first link would lack the network pay target
              // and could be copied too early, as the owner
              // walk showed. The only link shown is final.
              await writeOnNetwork(invoice);
            } finally {
              busyRef.current = false;
            }
          }}
        >
          Make invoice
        </button>
      </div>
      {chainNote !== null && <p style={{ fontSize: 18 }}>{chainNote}</p>}
      {failedInvoiceId !== null && (
        <button
          style={{ fontSize: 18, padding: 12 }}
          disabled={writing}
          onClick={async () => {
            const invoice = store.getInvoice(failedInvoiceId);
            if (!invoice || busyRef.current) {
              return;
            }
            busyRef.current = true;
            try {
              await writeOnNetwork(invoice);
            } finally {
              busyRef.current = false;
            }
          }}
        >
          Write this bill on the network
        </button>
      )}
      {link !== null && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 18 }}>Send this link to your client:</p>
          <p style={{ fontSize: 18, wordBreak: "break-all" }}>{link}</p>
          <button
            style={{ fontSize: 18, padding: 12 }}
            onClick={async () => {
              setChainNote(
                (await copyText(link))
                  ? "Link copied."
                  : "Copy the link above by hand.",
              );
            }}
          >
            Copy link
          </button>
        </div>
      )}
    </main>
  );
}
