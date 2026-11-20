// @vitest-environment node
// PLUMBING CHECK ONLY. This flow runs on shared test accounts
// to check the chain wiring cheaply on a local network. It is
// not product proof: no real user wallet takes part. Product
// proof lives in the testnet spikes and the slice acceptance
// run, per the owner rule that testing is real time with real
// wallets.
import { describe, expect, it } from "vitest";
import { actorFor, createChainSession, type ChainSession } from "./wallet";
import { createInvoiceOnChain, readReceiptsOnChain } from "./invoiceChain";
import { payInvoiceOnChain } from "./payChain";

describe("plumbing check: local network flow on test accounts", () => {
  it(
    "invoice on chain, client pays, worker sees the receipt, third account sees nothing",
    async () => {
      const session: ChainSession = await createChainSession();

      await createInvoiceOnChain(actorFor(session, "worker"), {
        billId: 42,
        amount: 1250,
        dueMark: 7,
      });

      const before = await readReceiptsOnChain(actorFor(session, "worker"));
      expect(before.count).toBe(0);

      const paid = await payInvoiceOnChain(actorFor(session, "client"), {
        worker: session.accounts.worker,
        billId: 42,
        amount: 1250,
        payerMark: 99,
      });
      expect(paid.seconds).toBeGreaterThan(0);

      const workerView = await readReceiptsOnChain(actorFor(session, "worker"));
      expect(workerView.count).toBe(1);
      expect(workerView.billId).toBe(42);
      expect(workerView.amount).toBe(1250);
      expect(workerView.payerMark).toBe(99);

      const otherView = await readReceiptsOnChain(actorFor(session, "other"));
      expect(otherView.count).toBe(0);
    },
    600_000,
  );
});
