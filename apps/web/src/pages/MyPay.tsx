import { useState } from "react";
import type { Store } from "../domain/store";
import type { Invoice } from "../domain/invoice";
import { encodePayLink } from "../domain/payLink";
import type { ReceiptView } from "../chain/invoiceChain";
import { connectedUserRole } from "../chain/session";
import type { BillPaymentView, ChainBillTarget } from "../chain/session";
import RoleBoundary from "./RoleBoundary";
import { copyText } from "./copyText";
import { useElapsedSeconds } from "./useElapsedSeconds";

export default function MyPay({
  store,
  readLive,
  readPaymentsLive,
  writeLive,
  currentWorkerAddress,
}: {
  store: Store;
  readLive?: () => Promise<ReceiptView | null>;
  readPaymentsLive?: (bills: Invoice[]) => Promise<BillPaymentView[] | null>;
  writeLive?: (bill: Invoice) => Promise<ChainBillTarget | null>;
  currentWorkerAddress?: string | null;
}) {
  const [, setTick] = useState(0);
  const [live, setLive] = useState<ReceiptView | null>(null);
  const [liveState, setLiveState] = useState<"idle" | "reading" | "done" | "off">(
    "idle",
  );
  const [payments, setPayments] = useState<BillPaymentView[] | null>(null);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<string | null>(null);
  const writingSeconds = useElapsedSeconds(writingId !== null);
  const readingSeconds = useElapsedSeconds(liveState === "reading");

  const ownBills = store.invoices.filter((invoice) => {
    if ((invoice.side ?? "made") !== "made") {
      return false;
    }
    // When a wallet is connected, a network bill made by a
    // different wallet on this device is not this wallet's
    // bill. Local bills with no network target still show.
    return (
      !currentWorkerAddress ||
      !invoice.chainWorkerAddress ||
      invoice.chainWorkerAddress === currentWorkerAddress
    );
  });

  const read = async () => {
    if (!readLive && !readPaymentsLive) {
      return;
    }
    setLiveState("reading");
    setPaymentNote(null);
    let anyLive = false;
    try {
      if (readLive) {
        const view = await readLive();
        if (view !== null) {
          anyLive = true;
          setLive(view);
        }
      }
      if (readPaymentsLive) {
        const views = await readPaymentsLive(store.invoices);
        if (views !== null) {
          anyLive = true;
          setPayments(views);
          for (const view of views) {
            if (view.paid) {
              store.markInvoicePaidOnNetwork(view.invoiceId, view.amount);
            }
          }
          setTick((tick) => tick + 1);
        } else if (!readLive) {
          setPaymentNote(
            "Connect your wallet to make bills on the home page first.",
          );
        }
      }
      setLiveState(anyLive ? "done" : "off");
    } catch {
      setLiveState("idle");
      setPaymentNote("The network read did not finish. Try again.");
    }
  };

  const writeBill = async (invoice: Invoice) => {
    if (!writeLive || writingId) {
      return;
    }
    if (
      invoice.chainWorkerAddress &&
      currentWorkerAddress &&
      invoice.chainWorkerAddress !== currentWorkerAddress
    ) {
      setPaymentNote("This bill belongs to another wallet on this device.");
      return;
    }
    setWritingId(invoice.id);
    setPaymentNote("Writing the bill on the network.");
    try {
      const target = await writeLive(invoice);
      if (!target) {
        setPaymentNote("Connect your wallet to make bills on the home page first.");
        return;
      }
      store.markInvoiceOnChain(invoice.id, target);
      setPaymentNote(
        store.saveFailed
          ? "This bill is written on the network, but it could not be saved on this device."
          : "This bill is written on the network. Its link is ready below.",
      );
      setTick((tick) => tick + 1);
    } catch (error) {
      setPaymentNote(
        error instanceof Error
          ? error.message
          : "The network write did not finish.",
      );
    } finally {
      setWritingId(null);
    }
  };

  if (connectedUserRole() === "client") {
    return <RoleBoundary needed="worker" />;
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>My pay</h1>
      {writingId !== null ? (
        <p style={{ fontSize: 18 }}>
          Writing the bill on the network. Building your private proof,
          which is the slow part. {writingSeconds} seconds so far, and it
          can take around half a minute. Do not close this page.
        </p>
      ) : paymentNote !== null ? (
        <p style={{ fontSize: 18 }}>{paymentNote}</p>
      ) : null}
      {ownBills.length === 0 && (
        <p style={{ fontSize: 18 }}>No bills yet. Make your first invoice from the home page.</p>
      )}
      <div style={{ display: "grid", gap: 16 }}>
        {ownBills.map((invoice) => {
          const networkLink =
            invoice.state === "unpaid" &&
            invoice.chainWorkerAddress &&
            invoice.chainBillId
              ? `#/pay/${encodePayLink(invoice, {
                  workerAddress: invoice.chainWorkerAddress,
                  billId: invoice.chainBillId,
                })}`
              : null;
          return (
            <div key={invoice.id} style={{ border: "1px solid #999", padding: 12 }}>
              <p style={{ fontSize: 20, margin: "4px 0" }}>{invoice.workTitle}</p>
              <p style={{ fontSize: 18, margin: "4px 0" }}>Amount: {invoice.amount}</p>
              <p style={{ fontSize: 18, margin: "4px 0" }}>Client: {invoice.clientMark}</p>
              <p style={{ fontSize: 18, margin: "4px 0" }}>
                {invoice.state === "paid"
                  ? invoice.paidOn
                    ? `Paid in full on ${invoice.paidOn}.`
                    : invoice.paidOnNetwork
                      ? "Paid in full on the network."
                      : "Paid in full."
                  : "Not paid yet."}
              </p>
              {networkLink && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 18, margin: "4px 0" }}>
                    Send this network pay link:
                  </p>
                  <p style={{ fontSize: 18, margin: "4px 0", wordBreak: "break-all" }}>
                    {networkLink}
                  </p>
                  <button
                    style={{ fontSize: 18, padding: 12 }}
                    onClick={async () => {
                      setPaymentNote(
                        (await copyText(networkLink))
                          ? "Link copied."
                          : "Copy the link above by hand.",
                      );
                    }}
                  >
                    Copy link
                  </button>
                </div>
              )}
              {invoice.state === "unpaid" && !invoice.chainBillId && writeLive && (
                <button
                  style={{ fontSize: 18, padding: 12, marginTop: 12 }}
                  disabled={writingId !== null}
                  onClick={() => void writeBill(invoice)}
                >
                  Write this bill on the network
                </button>
              )}
            </div>
          );
        })}
      </div>
      {(readLive || readPaymentsLive) && (
        <div style={{ marginTop: 32, border: "1px solid #999", padding: 16 }}>
          <p style={{ fontSize: 20, margin: "4px 0" }}>On the network</p>
          <button style={{ fontSize: 18, padding: 12 }} onClick={read}>
            Read my pay from the network
          </button>
          {liveState === "reading" && (
            <p style={{ fontSize: 18 }}>
              Reading in private. {readingSeconds} seconds so far. This can
              take a few seconds.
            </p>
          )}
          {liveState === "off" && (
            <p style={{ fontSize: 18 }}>
              Your wallet is not connected. Connect it on the home page
              first.
            </p>
          )}
          {payments !== null && (
            <div>
              <p style={{ fontSize: 18 }}>
                Checked {payments.length}{" "}
                {payments.length === 1 ? "bill" : "bills"} on the network.{" "}
                {payments.filter((view) => view.paid).length} paid.
              </p>
              {payments.map((view) => (
                <p key={view.invoiceId} style={{ fontSize: 18 }}>
                  Bill {view.billId}:{" "}
                  {view.paid
                    ? `paid in full, amount ${view.amount}.`
                    : "not paid yet."}
                </p>
              ))}
            </div>
          )}
          {liveState === "done" && live !== null && live.count === 0 && payments === null && (
            <p style={{ fontSize: 18 }}>
              This wallet has no pay records on the network yet. Receipts
              show here after a client pays one of your bills.
            </p>
          )}
          {liveState === "done" && live !== null && live.count > 0 && (
            <p style={{ fontSize: 18 }}>
              Receipts found: {live.count}. First receipt: Bill {live.billId}: paid in full, amount {live.amount}. Receipt
              read from the network.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
