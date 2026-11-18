import type { ChainSession, Role } from "./wallet";
import { AZTEC_NODE_URL } from "./settings";
import type { ReceiptView } from "./invoiceChain";

// Holds the live local network session for the pages. The chain
// code is loaded only when a person signs in, so the fake data
// path stays light. Fake money and test accounts only.
let session: ChainSession | null = null;
let role: Role = "worker";
const billIds = new Map<string, number>();
let nextBillId = 1;

export async function signInTestAccount(nextRole: Role): Promise<void> {
  role = nextRole;
  if (!session) {
    const { createChainSession } = await import("./wallet");
    session = await createChainSession(AZTEC_NODE_URL);
  }
}

export function signedInRole(): Role {
  return role;
}

export function hasChainSession(): boolean {
  return session !== null;
}

export function billIdFor(webInvoiceId: string): number {
  const existing = billIds.get(webInvoiceId);
  if (existing !== undefined) {
    return existing;
  }
  const billId = nextBillId;
  nextBillId += 1;
  billIds.set(webInvoiceId, billId);
  return billId;
}

export async function createInvoiceLive(input: {
  webInvoiceId: string;
  amount: number;
}): Promise<void> {
  if (!session) {
    return;
  }
  const { createInvoiceOnChain } = await import("./invoiceChain");
  await createInvoiceOnChain(session, {
    billId: billIdFor(input.webInvoiceId),
    amount: input.amount,
    dueMark: 7,
  });
}

export async function payInvoiceLive(input: {
  webInvoiceId: string;
  amount: number;
}): Promise<{ seconds: number } | null> {
  if (!session) {
    return null;
  }
  const { payInvoiceOnChain } = await import("./payChain");
  return payInvoiceOnChain(session, {
    billId: billIdFor(input.webInvoiceId),
    amount: input.amount,
    payerMark: 99,
  });
}

export async function readMyReceiptsLive(): Promise<ReceiptView | null> {
  if (!session) {
    return null;
  }
  const { readReceiptsOnChain } = await import("./invoiceChain");
  return readReceiptsOnChain(session, role);
}

export async function checkMarkedProofLive(input: {
  claim: import("../domain/claim").SinglePaymentClaim;
  billId: number;
}): Promise<"valid" | "broken" | null> {
  if (!session) {
    return null;
  }
  const { checkProof } = await import("./proofChain");
  const { today } = await import("../domain/store");
  const result = await checkProof(session, input.claim, input.billId, today());
  return result === "valid" ? "valid" : "broken";
}

export async function currentSessionForProof(): Promise<ChainSession | null> {
  return session;
}
