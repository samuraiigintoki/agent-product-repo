// @vitest-environment node
// PLUMBING CHECK ONLY. Needs the local Aztec network on
// localhost:8080. The worker is a FRESH user wallet (random
// keys made here, never test keys, never stored). Its first
// network fee is covered by the local network fee sponsor.
// The client stays a test account, so this checks wiring,
// not the real product path. Product proof lives in the
// testnet spikes and the slice acceptance run.
// Run on its own: npx vitest run src/chain/userFlow.test.ts
import { describe, expect, it } from "vitest";
import { createKeyMaterial } from "./keyVault";
import { deriveWalletAddress } from "./userWallet";
import { actorFor, createChainSession } from "./wallet";
import { createInvoiceOnChain, readReceiptsOnChain } from "./invoiceChain";
import { payInvoiceOnChain } from "./payChain";

describe("user wallet worker flow", () => {
  it(
    "fresh user wallet writes a bill, test client pays, user wallet reads the receipt",
    async () => {
      const material = createKeyMaterial();
      const userAddress = await deriveWalletAddress(material);

      const session = await createChainSession("http://localhost:8080", material);
      expect(session.userRole).toBe("worker");
      expect(session.accounts.worker.toString()).toBe(userAddress);
      expect(session.workerFee).not.toBeNull();

      await createInvoiceOnChain(actorFor(session, "worker"), {
        billId: 77,
        amount: 500,
        dueMark: 7,
      });

      const before = await readReceiptsOnChain(actorFor(session, "worker"));
      expect(before.count).toBe(0);

      await payInvoiceOnChain(actorFor(session, "client"), {
        worker: session.accounts.worker,
        billId: 77,
        amount: 500,
        payerMark: 99,
      });

      const workerView = await readReceiptsOnChain(actorFor(session, "worker"));
      expect(workerView.count).toBe(1);
      expect(workerView.billId).toBe(77);
      expect(workerView.amount).toBe(500);

      const otherView = await readReceiptsOnChain(actorFor(session, "other"));
      expect(otherView.count).toBe(0);
    },
    600_000,
  );

  it("refuses wallet keys that cannot be read, in plain words", async () => {
    await expect(
      createChainSession("http://localhost:8080", {
        secret: "not-a-key",
        salt: "not-a-key",
        signingKey: "not-a-key",
      }),
    ).rejects.toThrow("Your wallet keys could not be read.");
  }, 60_000);
});
