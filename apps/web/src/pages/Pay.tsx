import { useRef, useState } from "react";
import {
  checkInvoicePaidLive,
  hasChainSession,
  payInvoiceLive,
} from "../chain/session";
import type { Store } from "../domain/store";
import { decodePayLink } from "../domain/payLink";
import { shortAddress } from "../chain/userWallet";

export default function Pay({ store, id }: { store: Store; id: string }) {
  const [, setPaidTick] = useState(0);
  const [chainNote, setChainNote] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  // A carrying link brings its bill with it. Import it once so
  // this device can show and pay it. Old short links fall back
  // to a plain store look up. A link whose bill id is already
  // here with different fields is a clash, never a payment.
  const linked = id.startsWith("p.") ? decodePayLink(id) : null;
  const linkBroken = id.startsWith("p.") && linked === null;
  const conflict = linked ? store.getPayLinkConflict(linked) : null;
  const invoice =
    linked && !conflict
      ? store.importInvoice(linked)
      : linked
        ? store.getInvoice(linked.id)
        : store.getInvoice(id);

  if (linkBroken) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28 }}>This bill link does not work.</h1>
        <p style={{ fontSize: 18 }}>Ask the worker to send the link again.</p>
      </main>
    );
  }

  if (conflict) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28 }}>This bill link clashes.</h1>
        <p style={{ fontSize: 18 }}>{conflict}</p>
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
      <p>Fake test money only. No real money moves.</p>
      {linked?.workerAddress && !hasChainSession() && invoice.state !== "paid" && (
        <p style={{ fontSize: 18 }}>
          Connect your wallet as client on the home page first. This
          bill will stay unpaid here until the network pay runs.
        </p>
      )}
      {!linked?.workerAddress && !hasChainSession() && invoice.state !== "paid" && (
        <p style={{ fontSize: 18 }}>
          No wallet is connected. Paying here only marks this device.
        </p>
      )}
      {chainNote !== null && <p style={{ fontSize: 18 }}>{chainNote}</p>}
      {invoice.state === "paid" ? (
        <p style={{ fontSize: 22 }}>Paid. Thank you.</p>
      ) : (
        <button
          style={{ fontSize: 20, padding: 14 }}
          disabled={paying}
          onClick={async () => {
            if (payingRef.current) {
              return;
            }
            if (!hasChainSession()) {
              if (linked?.workerAddress) {
                // A network link must not spend its one paid
                // mark on this device. It stays unpaid so the
                // client can connect and pay for real.
                setChainNote(
                  "Connect your wallet as client on the home page, then open this link again. This bill was not marked paid.",
                );
                return;
              }
              store.payInvoice(invoice.id);
              setPaidTick((tick) => tick + 1);
              return;
            }
            if (!linked?.workerAddress) {
              // An old link carries no pay target, so there is
              // nothing true to pay against on the network. It
              // must not be marked paid as if the network pay
              // had happened.
              setChainNote(
                "This is an old link. Ask the worker to send a new link to pay on the network. This bill was not marked paid.",
              );
              return;
            }
            payingRef.current = true;
            setPaying(true);
            setChainNote(
              "Paying in private on the network. Your device does the private work, so this can take a few seconds. Please wait.",
            );
            try {
              const target = {
                workerAddress: linked.workerAddress,
                billId: linked.billId ?? 0,
              };
              const alreadyPaid = target.billId
                ? await checkInvoicePaidLive(target).catch(() => null)
                : null;
              if (alreadyPaid) {
                store.payInvoice(invoice.id);
                setPaidTick((tick) => tick + 1);
                setChainNote("This bill is already paid on the network.");
                return;
              }
              const paid = await payInvoiceLive({
                webInvoiceId: invoice.id,
                amount: invoice.amount,
                workerAddress: linked.workerAddress,
                billId: linked.billId ?? undefined,
              });
              if (!paid) {
                setChainNote("The network pay did not finish. This bill was not marked paid.");
                return;
              }
              store.payInvoice(invoice.id);
              setPaidTick((tick) => tick + 1);
              setChainNote(
                `Paid on the network. That step took about ${paid.seconds} seconds.`,
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : "";
              if (
                message.includes("connected to make bills") ||
                message.includes("connected to pay") ||
                message.includes("wallet is locked") ||
                message.includes("Unlock your wallet")
              ) {
                setChainNote(message);
                return;
              }
              // The send may have landed while its reply was
              // lost. Ask the contract before calling it unpaid.
              const landed =
                linked.billId !== null
                  ? await checkInvoicePaidLive({
                      workerAddress: linked.workerAddress,
                      billId: linked.billId,
                    }).catch(() => null)
                  : null;
              if (landed) {
                store.payInvoice(invoice.id);
                setPaidTick((tick) => tick + 1);
                setChainNote("This bill is already paid on the network.");
                return;
              }
              setChainNote("The network pay did not finish. This bill was not marked paid.");
            } finally {
              payingRef.current = false;
              setPaying(false);
            }
          }}
        >
          Pay this bill
        </button>
      )}
    </main>
  );
}
