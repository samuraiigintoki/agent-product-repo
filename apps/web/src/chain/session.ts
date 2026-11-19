import type { ChainSession, Role } from "./wallet";
import { AZTEC_NODE_URL } from "./settings";
import type { ReceiptView } from "./invoiceChain";
import { isWalletOpen, openKeyMaterial } from "./userWallet";

// Holds the live local network session for the pages. The chain
// code is loaded only when a person signs in, so the fake data
// path stays light. Fake money and test accounts only, except
// the worker, which can be the user's own wallet once they
// unlock it and connect.
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

// Connects the unlocked user wallet in one role: "worker" to
// make bills, "client" to pay one. One session holds one user
// role. Any older session is replaced, so the role on chain
// is the user's own address from this point.
export async function signInWithUserWallet(
  nextRole: Role = "worker",
): Promise<void> {
  const material = openKeyMaterial();
  if (!material) {
    throw new Error("Unlock your wallet first.");
  }
  const { createChainSession } = await import("./wallet");
  session = await createChainSession(AZTEC_NODE_URL, material, nextRole);
  role = nextRole;
}

export function signedInRole(): Role {
  return role;
}

export function hasChainSession(): boolean {
  return session !== null;
}

export function workerIsUserWallet(): boolean {
  return session?.userRole === "worker";
}

// The user role this session is connected in, or null when no
// user wallet is connected.
export function connectedUserRole(): Role | null {
  return session?.userRole ?? null;
}

// Drops the live session. Called when the wallet is locked or
// removed, so nothing on the network side keeps working with
// keys the user just put away.
export function dropChainSession(): void {
  session = null;
}

// Actions from a user wallet need the wallet still open.
// Locking drops the session in the screens; this is the second
// lock on the door for any path that missed it.
function throwIfUserWalletLocked(): void {
  if (session?.userRole && !isWalletOpen()) {
    session = null;
    throw new Error(
      "Your wallet is locked. Unlock it to use the network.",
    );
  }
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
  if (session.userRole === "client") {
    throw new Error(
      "This wallet is connected to pay bills. Connect as worker to make bills.",
    );
  }
  throwIfUserWalletLocked();
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
  if (session.userRole === "worker") {
    throw new Error(
      "This wallet is connected to make bills. Connect as client to pay.",
    );
  }
  if (session.userRole === "client") {
    throwIfUserWalletLocked();
  }
  const { payInvoiceOnChain } = await import("./payChain");
  return payInvoiceOnChain(session, {
    worker: session.accounts.worker,
    billId: billIdFor(input.webInvoiceId),
    amount: input.amount,
    payerMark: 99,
  });
}

export async function readMyReceiptsLive(): Promise<ReceiptView | null> {
  if (!session) {
    return null;
  }
  if (role === "worker") {
    throwIfUserWalletLocked();
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
  if (!session) {
    return null;
  }
  // Marking a proof is a worker write; a locked user wallet
  // must not mark anything.
  if (session.userRole === "worker" && !isWalletOpen()) {
    session = null;
    return null;
  }
  return session;
}
