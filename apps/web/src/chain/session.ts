import type { ChainSession, Role } from "./wallet";
import { AZTEC_NODE_URL } from "./settings";
import type { ReceiptView } from "./invoiceChain";
import { isWalletOpen, openKeyMaterial } from "./userWallet";

// Holds the live network session for the pages. The chain
// code is loaded only when a person connects, so the on
// device path stays light. The only way in is the user's own
// wallet. Test accounts exist inside code tests only; no app
// screen can sign in with one. Do not wire them back in.
let session: ChainSession | null = null;
let role: Role = "worker";
const billIds = new Map<string, number>();
let nextBillId = 1;

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

// The worker address of the live session, so the invoice
// page can put the real pay targets into a version 2 link.
export function chainWorkerAddress(): string | null {
  return session ? session.accounts.worker.toString() : null;
}

export async function payInvoiceLive(input: {
  webInvoiceId: string;
  amount: number;
  // Set when the pay link (version 2) names the worker and
  // the chain bill number. Then the pay goes to that worker,
  // who may live on a device this session has never met.
  workerAddress?: string;
  billId?: number;
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
  let worker = session.accounts.worker;
  if (input.workerAddress) {
    const { AztecAddress } = await import("@aztec-labs/aztec.js/addresses");
    worker = AztecAddress.schema.parse(input.workerAddress);
  }
  return payInvoiceOnChain(session, {
    worker,
    billId: input.billId ?? billIdFor(input.webInvoiceId),
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
