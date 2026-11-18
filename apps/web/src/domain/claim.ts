import type { Invoice } from "./invoice";

export type ClaimCheck = "valid" | "expired" | "broken";

export interface SinglePaymentClaim {
  invoiceId: string;
  text: string;
  amount: number | null;
  expiresAt: string;
  seal: string;
}

function sealOf(parts: {
  invoiceId: string;
  text: string;
  amount: number | null;
  expiresAt: string;
}): string {
  const raw = [
    parts.invoiceId,
    parts.text,
    parts.amount === null ? "hidden" : String(parts.amount),
    parts.expiresAt,
  ].join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

export function createSinglePaymentClaim(
  invoice: Invoice,
  showAmount: boolean,
  expiresAt: string,
): SinglePaymentClaim {
  if (invoice.state !== "paid" || invoice.paidOn === null) {
    throw new Error("Invoice is not paid in full, so no claim can be made.");
  }
  const text = `This bill was paid in full on ${invoice.paidOn}.`;
  const amount = showAmount ? invoice.amount : null;
  const base = { invoiceId: invoice.id, text, amount, expiresAt };
  return { ...base, seal: sealOf(base) };
}

export function checkClaim(
  claim: SinglePaymentClaim,
  now: string,
): ClaimCheck {
  const expected = sealOf({
    invoiceId: claim.invoiceId,
    text: claim.text,
    amount: claim.amount,
    expiresAt: claim.expiresAt,
  });
  if (expected !== claim.seal) {
    return "broken";
  }
  if (new Date(now).getTime() > new Date(claim.expiresAt).getTime()) {
    return "expired";
  }
  return "valid";
}
