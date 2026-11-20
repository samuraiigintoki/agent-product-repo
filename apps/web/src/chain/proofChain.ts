import {
  createSinglePaymentClaim,
  checkClaim as checkClaimWords,
  type ClaimCheck,
  type SinglePaymentClaim,
} from "../domain/claim";
import type { Invoice } from "../domain/invoice";
import type { ActorSession } from "./wallet";

// Expiry travels on chain as one plain number, YYYYMMDD, so a
// person can read it and compare it without special tools.
export function expiryNumber(dateText: string): number {
  return Number(dateText.replaceAll("-", ""));
}

export function buildClaimForBill(
  invoice: Invoice,
  showAmount: boolean,
  expiresAt: string,
): SinglePaymentClaim {
  return createSinglePaymentClaim(invoice, showAmount, expiresAt);
}

// The claim hash covers the claim words, the amount choice, the
// bill mark, and the expiry. Change any of them and the hash no
// longer matches the public mark. This is a tamper seal for the
// fake money first version, made on the worker device from the
// worker receipt.
export function claimHash(claim: SinglePaymentClaim, billId: number): bigint {
  const raw = [
    claim.text,
    claim.amount === null ? "hidden" : String(claim.amount),
    String(billId),
    claim.expiresAt,
    claim.seal,
  ].join("|");
  let hash = 0x811c9dc5n;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= BigInt(raw.charCodeAt(i));
    hash = (hash * 0x01000193n) & 0xffffffffffffffffn;
  }
  return hash;
}

export async function markProofOnChain(
  actor: ActorSession,
  claim: SinglePaymentClaim,
  billId: number,
): Promise<void> {
  await actor.contract.methods
    .mark_proof(claimHash(claim, billId), expiryNumber(claim.expiresAt))
    .send({
      from: actor.account,
      ...(actor.fee ? { fee: { paymentMethod: actor.fee } } : {}),
    });
}

export async function readProofExpiryOnChain(
  actor: ActorSession,
  claim: SinglePaymentClaim,
  billId: number,
): Promise<number> {
  const { result } = await actor.contract.methods
    .proof_expiry(claimHash(claim, billId))
    .simulate({ from: actor.account });
  return Number(result as bigint);
}

// Valid only when the claim words check out, the public mark is
// on chain with the same expiry, and today is not past expiry.
export async function checkProof(
  actor: ActorSession,
  claim: SinglePaymentClaim,
  billId: number,
  now: string,
): Promise<ClaimCheck> {
  const words = checkClaimWords(claim, now);
  if (words !== "valid") {
    return words;
  }
  const stored = await readProofExpiryOnChain(actor, claim, billId);
  if (stored !== expiryNumber(claim.expiresAt)) {
    return "broken";
  }
  return "valid";
}
