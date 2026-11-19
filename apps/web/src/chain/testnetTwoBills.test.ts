// @vitest-environment node
// Live set after the break-test fixes: two bills for one
// worker, paid out of order (bill 2 first, then bill 1).
// The per-bill paid flag must track each bill separately:
// paying bill 2 must not mark bill 1 paid, and the worker's
// receipt count must reach 2. Fresh wallets only, keys made
// in memory and never stored. Small chain sample, not a
// crowd run.
import { describe, expect, it } from "vitest";
import { createUserChainSession } from "./wallet";
import { createKeyMaterial } from "./keyVault";
import {
  createInvoiceOnChain,
  readInvoicePaidOnChain,
  readReceiptsOnChain,
} from "./invoiceChain";
import { payInvoiceOnChain } from "./payChain";

function secondsSince(start: number): number {
  return Math.round((Date.now() - start) / 1000);
}

describe("live set: two bills paid out of order", () => {
  it(
    "pays bill 2 first, then bill 1, and each paid flag tracks its own bill",
    async () => {
      const worker = await createUserChainSession(
        undefined,
        createKeyMaterial(),
        "worker",
      );
      const client = await createUserChainSession(
        undefined,
        createKeyMaterial(),
        "client",
      );
      try {
        await createInvoiceOnChain(worker, { billId: 1, amount: 300, dueMark: 7 });
        await createInvoiceOnChain(worker, { billId: 2, amount: 800, dueMark: 7 });
        console.log("TWOBILLS both bills written");

        expect(
          await readInvoicePaidOnChain(client, worker.account, 1),
        ).toBe(false);
        expect(
          await readInvoicePaidOnChain(client, worker.account, 2),
        ).toBe(false);

        let start = Date.now();
        await payInvoiceOnChain(client, {
          worker: worker.account,
          billId: 2,
          amount: 800,
          payerMark: 99,
        });
        console.log(`TWOBILLS bill 2 paid first: ${secondsSince(start)}s`);

        // The out-of-order pay lands on bill 2 only.
        expect(
          await readInvoicePaidOnChain(client, worker.account, 2),
        ).toBe(true);
        expect(
          await readInvoicePaidOnChain(client, worker.account, 1),
        ).toBe(false);

        start = Date.now();
        await payInvoiceOnChain(client, {
          worker: worker.account,
          billId: 1,
          amount: 300,
          payerMark: 99,
        });
        console.log(`TWOBILLS bill 1 paid second: ${secondsSince(start)}s`);

        expect(
          await readInvoicePaidOnChain(client, worker.account, 1),
        ).toBe(true);
        expect(
          await readInvoicePaidOnChain(client, worker.account, 2),
        ).toBe(true);

        const view = await readReceiptsOnChain(worker);
        console.log(
          `TWOBILLS receipts count=${view.count} first bill=${view.billId} amount=${view.amount}`,
        );
        expect(view.count).toBe(2);

        // Bill 2 is still protected against a second pay.
        start = Date.now();
        await expect(
          payInvoiceOnChain(client, {
            worker: worker.account,
            billId: 2,
            amount: 800,
            payerMark: 99,
          }),
        ).rejects.toThrow();
        console.log(`TWOBILLS second pay of bill 2 rejected: ${secondsSince(start)}s`);
      } finally {
        await client.wallet.stop().catch(() => {});
        await worker.wallet.stop().catch(() => {});
      }
    },
    1_500_000,
  );
});
