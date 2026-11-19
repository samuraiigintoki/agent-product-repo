import type { Role, UserChainSession } from "./wallet";
import { AZTEC_NODE_URL } from "./settings";
import type { ReceiptView } from "./invoiceChain";
import { isWalletOpen, openKeyMaterial } from "./userWallet";

// Holds the live network session for the pages: ONE wallet,
// the user's own, in one role. The chain code is loaded only
// when a person connects, so the on device path stays light.
// Test accounts exist inside code tests only; no app screen
// can sign in with one. Do not wire them back in.
let session: UserChainSession | null = null;
const billIds = new Map<string, number>();
let nextBillId = 1;

async function stopSession(): Promise<void> {
  const old = session;
  session = null;
  if (old) {
    try {
      await old.wallet.stop();
    } catch {
      // Closing is best effort; a stuck close must not block
      // locking the wallet on screen.
    }
  }
}

// Drops the live session and closes its wallet store. Called
// when the wallet is locked or removed, so nothing on the
// network side keeps working with keys the user just put
// away, and so the browser wallet store is free for the next
// connect (only one store may live per site).
export function dropChainSession(): void {
  void stopSession();
}

// Connects the unlocked user wallet in one role: "worker" to
// make bills, "client" to pay one. One session holds one user
// role. Any older session is closed first, wallet store and
// all, before the new one opens.
export async function signInWithUserWallet(
  nextRole: Role = "worker",
): Promise<void> {
  const material = openKeyMaterial();
  if (!material) {
    throw new Error("Unlock your wallet first.");
  }
  await stopSession();
  const { createUserChainSession } = await import("./wallet");
  try {
    session = await createUserChainSession(AZTEC_NODE_URL, material, nextRole);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("already in use")
    ) {
      throw new Error(
        "The wallet store is open in another tab of this site. Close the other tabs, then connect again.",
      );
    }
    throw error;
  }
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

// Actions from the user wallet need the wallet still open.
// Locking drops the session in the screens; this is the second
// lock on the door for any path that missed it.
function throwIfUserWalletLocked(): void {
  if (session && !isWalletOpen()) {
    dropChainSession();
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
  const { createInvoiceOnChain, readInvoiceCountOnChain } = await import(
    "./invoiceChain"
  );
  let billId = billIds.get(input.webInvoiceId);
  if (billId === undefined) {
    // A fresh page has an empty bill number map. Ask the
    // network how many bills this wallet already has, so the
    // next number cannot reuse one the network would reject.
    const count = await readInvoiceCountOnChain(session);
    billId = Math.max(nextBillId, count + 1);
    billIds.set(input.webInvoiceId, billId);
    nextBillId = billId + 1;
  }
  await createInvoiceOnChain(session, {
    billId,
    amount: input.amount,
    dueMark: 7,
  });
}

// The worker address of the live session, so the invoice
// page can put the real pay targets into a version 2 link.
export function chainWorkerAddress(): string | null {
  return session ? session.account.toString() : null;
}

export async function payInvoiceLive(input: {
  webInvoiceId: string;
  amount: number;
  // Set when the pay link (version 2) names the worker and
  // the chain bill number. Then the pay goes to that worker,
  // who may live on a device this session has never met.
  // Without it there is nothing true to pay against, and the
  // pay stays on this device only.
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
  throwIfUserWalletLocked();
  if (!input.workerAddress) {
    return null;
  }
  const { payInvoiceOnChain } = await import("./payChain");
  const { AztecAddress } = await import("@aztec-labs/aztec.js/addresses");
  return payInvoiceOnChain(session, {
    worker: AztecAddress.schema.parse(input.workerAddress),
    billId: input.billId ?? billIdFor(input.webInvoiceId),
    amount: input.amount,
    payerMark: 99,
  });
}

export async function readMyReceiptsLive(): Promise<ReceiptView | null> {
  if (!session) {
    return null;
  }
  if (session.userRole !== "worker") {
    return null;
  }
  throwIfUserWalletLocked();
  const { readReceiptsOnChain } = await import("./invoiceChain");
  return readReceiptsOnChain(session);
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

export async function currentSessionForProof(): Promise<UserChainSession | null> {
  if (!session) {
    return null;
  }
  // Marking a proof is a worker write; a locked user wallet
  // must not mark anything.
  if (session.userRole === "worker" && !isWalletOpen()) {
    dropChainSession();
    return null;
  }
  return session;
}
