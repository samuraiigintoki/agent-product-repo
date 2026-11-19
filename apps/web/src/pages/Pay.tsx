import { useState } from "react";
import { hasChainSession, payInvoiceLive } from "../chain/session";
import type { Store } from "../domain/store";
import { decodePayLink } from "../domain/payLink";
import { shortAddress } from "../chain/userWallet";

export default function Pay({ store, id }: { store: Store; id: string }) {
  const [, setPaidTick] = useState(0);
  const [chainNote, setChainNote] = useState<string | null>(null);
  // A carrying link brings its bill with it. Import it once so
  // this device can show and pay it. Old short links fall back
  // to a plain store look up.
  const linked = id.startsWith("p.") ? decodePayLink(id) : null;
  const linkBroken = id.startsWith("p.") && linked === null;
  const invoice = linked
    ? store.importInvoice(linked)
    : store.getInvoice(id);

  if (linkBroken) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28 }}>This bill link does not work.</h1>
        <p style={{ fontSize: 18 }}>Ask the worker to send the link again.</p>
      </main>
    );
  }

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
      {linked?.workerAddress && (
        <p style={{ fontSize: 18 }}>
          Pays to wallet: {shortAddress(linked.workerAddress)}
        </p>
      )}
      <p>Fake test money only. This pay step is private in the real build.</p>
      {chainNote !== null && <p style={{ fontSize: 18 }}>{chainNote}</p>}
      {invoice.state === "paid" ? (
        <p style={{ fontSize: 22 }}>Paid. Thank you.</p>
      ) : (
        <button
          style={{ fontSize: 20, padding: 14 }}
          onClick={async () => {
            store.payInvoice(invoice.id);
            setPaidTick((tick) => tick + 1);
            if (hasChainSession() && linked && !linked.workerAddress) {
              // An old link carries no pay targets, so there is
              // nothing true to pay against on chain.
              setChainNote(
                "This is an old link. Ask the worker to send a new link to pay on the network. You can still mark it paid here.",
              );
            } else if (hasChainSession()) {
              setChainNote(
                "Paying in private on the local network. Your device does the private work, so this can take a few seconds. Please wait.",
              );
              try {
                const paid = await payInvoiceLive({
                  webInvoiceId: invoice.id,
                  amount: invoice.amount,
                  ...(linked?.workerAddress
                    ? {
                        workerAddress: linked.workerAddress,
                        billId: linked.billId ?? undefined,
                      }
                    : {}),
                });
                setChainNote(
                  paid
                    ? `Paid on the local network too. That step took about ${paid.seconds} seconds.`
                    : "Paid here only.",
                );
              } catch {
                setChainNote("Paid here, but the local network pay did not finish.");
              }
            }
          }}
        >
          Pay this bill
        </button>
      )}
    </main>
  );
}
