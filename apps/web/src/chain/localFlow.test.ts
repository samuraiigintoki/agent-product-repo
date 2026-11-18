// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createChainSession, type ChainSession } from "./wallet";
import { createInvoiceOnChain, readReceiptsOnChain } from "./invoiceChain";
import { payInvoiceOnChain } from "./payChain";

describe("local network flow", () => {
  it(
    "invoice on chain, client pays, worker sees the receipt, third account sees nothing",
    async () => {
      const session: ChainSession = await createChainSession();

      await createInvoiceOnChain(session, {
        billId: 42,
        amount: 1250,
        dueMark: 7,
      });

      const before = await readReceiptsOnChain(session, "worker");
      expect(before.count).toBe(0);

      const paid = await payInvoiceOnChain(session, {
        billId: 42,
        amount: 1250,
        payerMark: 99,
      });
      expect(paid.seconds).toBeGreaterThan(0);

      const workerView = await readReceiptsOnChain(session, "worker");
      expect(workerView.count).toBe(1);
      expect(workerView.billId).toBe(42);
      expect(workerView.amount).toBe(1250);
      expect(workerView.payerMark).toBe(99);

      const otherView = await readReceiptsOnChain(session, "other");
      expect(otherView.count).toBe(0);
    },
    600_000,
  );
});
