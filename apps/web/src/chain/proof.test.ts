// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createChainSession, type ChainSession } from "./wallet";
import { createInvoiceOnChain, readReceiptsOnChain } from "./invoiceChain";
import { payInvoiceOnChain } from "./payChain";
import {
  buildClaimForBill,
  checkProof,
  claimHash,
  expiryNumber,
  markProofOnChain,
  readProofExpiryOnChain,
} from "./proofChain";
import type { Invoice } from "../domain/invoice";

const paidInvoice: Invoice = {
  id: "bill-42",
  workTitle: "Logo design",
  amount: 1250,
  clientMark: "Client A",
  state: "paid",
  paidAmount: 1250,
  paidOn: "2026-11-18",
};

async function paidSession(): Promise<ChainSession> {
  const session = await createChainSession();
  await createInvoiceOnChain(session, { billId: 42, amount: 1250, dueMark: 7 });
  await payInvoiceOnChain(session, { billId: 42, amount: 1250, payerMark: 99 });
  const receipt = await readReceiptsOnChain(session, "worker");
  expect(receipt.count).toBe(1);
  return session;
}

describe("single payment proof", () => {
  it(
    "good proof passes, with the amount hidden",
    async () => {
      const session = await paidSession();
      const claim = buildClaimForBill(paidInvoice, false, "2027-05-18");
      await markProofOnChain(session, claim, 42);
      expect(claim.amount).toBeNull();
      const result = await checkProof(session, claim, 42, "2026-12-01");
      expect(result).toBe("valid");
    },
    600_000,
  );

  it(
    "edited amount and edited date fail, expired fails, hidden claim leaks no amount",
    async () => {
      const session = await paidSession();
      const claim = buildClaimForBill(paidInvoice, true, "2027-05-18");
      await markProofOnChain(session, claim, 42);

      const editedAmount = { ...claim, amount: 900 };
      expect(await checkProof(session, editedAmount, 42, "2026-12-01")).toBe(
        "broken",
      );

      const editedDate = {
        ...claim,
        text: "This bill was paid in full on 2020-01-01.",
      };
      expect(await checkProof(session, editedDate, 42, "2026-12-01")).toBe(
        "broken",
      );

      expect(await checkProof(session, claim, 42, "2027-06-01")).toBe(
        "expired",
      );

      // The public mark read back holds only the expiry number.
      const stored = await readProofExpiryOnChain(session, claim, 42);
      expect(stored).toBe(expiryNumber("2027-05-18"));
      expect(stored).not.toBe(1250);
      expect(claimHash(claim, 42)).not.toBe(1250n);
    },
    600_000,
  );
});
