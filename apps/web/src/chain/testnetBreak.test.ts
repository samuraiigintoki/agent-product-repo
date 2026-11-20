// @vitest-environment node
// Live break set on the public test network. Fresh wallets
// only, keys made in memory and never stored. This checks the
// contract rules against pays that should not land: missing
// bill, wrong amount, wrong worker, and a second pay. The
// crowd campaign stays local; this is a small chain sample.
import { describe, expect, it } from "vitest";
import { createUserChainSession } from "./wallet";
import { createKeyMaterial } from "./keyVault";
import {
  createInvoiceOnChain,
  readReceiptsOnChain,
} from "./invoiceChain";
import { payInvoiceOnChain } from "./payChain";

function secondsSince(start: number): number {
  return Math.round((Date.now() - start) / 1000);
}

describe("live break set: pays that should not land", () => {
  it(
    "rejects missing, wrong amount, wrong worker, and second pays",
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
      const billId = 1;
      const amount = 500;

      try {
        let start = Date.now();
        await expect(
          payInvoiceOnChain(client, {
            worker: worker.account,
            billId,
            amount,
            payerMark: 99,
          }),
        ).rejects.toThrow();
        console.log(`BREAK missing bill rejected: ${secondsSince(start)}s`);

        await createInvoiceOnChain(worker, { billId, amount, dueMark: 7 });
        console.log("BREAK real bill written");

        start = Date.now();
        await expect(
          payInvoiceOnChain(client, {
            worker: worker.account,
            billId,
            amount: amount + 1,
            payerMark: 99,
          }),
        ).rejects.toThrow();
        console.log(`BREAK wrong amount rejected: ${secondsSince(start)}s`);

        start = Date.now();
        await expect(
          payInvoiceOnChain(client, {
            worker: client.account,
            billId,
            amount,
            payerMark: 99,
          }),
        ).rejects.toThrow();
        console.log(`BREAK wrong worker rejected: ${secondsSince(start)}s`);

        start = Date.now();
        await payInvoiceOnChain(client, {
          worker: worker.account,
          billId,
          amount,
          payerMark: 99,
        });
        console.log(`BREAK right pay landed: ${secondsSince(start)}s`);

        start = Date.now();
        await expect(
          payInvoiceOnChain(client, {
            worker: worker.account,
            billId,
            amount,
            payerMark: 99,
          }),
        ).rejects.toThrow();
        console.log(`BREAK second pay rejected: ${secondsSince(start)}s`);

        const view = await readReceiptsOnChain(worker);
        expect(view.count).toBe(1);
        expect(view.billId).toBe(billId);
        expect(view.amount).toBe(amount);
      } finally {
        await client.wallet.stop().catch(() => {});
        await worker.wallet.stop().catch(() => {});
      }
    },
    1_500_000,
  );
});
