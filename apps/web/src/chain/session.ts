import type { Role, UserChainSession } from "./wallet";
import { AZTEC_NODE_URL } from "./settings";
import type { ReceiptView } from "./invoiceChain";
import type { Invoice } from "../domain/invoice";
import { isWalletOpen, openKeyMaterial } from "./userWallet";
import type { KeyMaterial } from "./keyVault";

// Holds the live network session for the pages: ONE wallet,
// the user's own, in one role. The chain code is loaded only
// when a person connects, so the on device path stays light.
// Test accounts exist inside code tests only; no app screen
// can sign in with one. Do not wire them back in.
let session: UserChainSession | null = null;
const billIds = new Map<string, number>();
let nextBillId = 1;
let billIdOwner: string | null = null;

// Bill numbers belong to one wallet. When the session
// wallet changes, the map from a past wallet must not carry
// into the new one.
function ensureBillIdOwner(owner: string): void {
  if (billIdOwner !== owner) {
    billIds.clear();
    nextBillId = 1;
    billIdOwner = owner;
  }
}

// Session changes run one at a time. Connect, disconnect,
// lock, and reconnect can be pressed in any order by a fast
// hand, but the browser allows one wallet store per site, so
// the old store must finish closing before a new one opens.
let sessionChange: Promise<void> = Promise.resolve();

function runSessionChange<T>(task: () => Promise<T>): Promise<T> {
  const run = sessionChange.then(task, task);
  sessionChange = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

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
export function dropChainSession(): Promise<void> {
  return runSessionChange(stopSession);
}

function sameKeyMaterial(
  a: KeyMaterial | null,
  b: KeyMaterial | null,
): boolean {
  return (
    a !== null &&
    b !== null &&
    a.secret === b.secret &&
    a.salt === b.salt &&
    a.signingKey === b.signingKey
  );
}

// Connects the unlocked user wallet in one role: "worker" to
// make bills, "client" to pay one. One session holds one user
// role. Any older session is closed first, wallet store and
// all, before the new one opens.
export async function signInWithUserWallet(
  nextRole: Role = "worker",
): Promise<void> {
  return runSessionChange(async () => {
    const material = openKeyMaterial();
    if (!material) {
      throw new Error("Unlock your wallet first.");
    }
    const materialAtStart = { ...material };
    await stopSession();
    const { createUserChainSession } = await import("./wallet");
    const createPromise = createUserChainSession(
      AZTEC_NODE_URL,
      material,
      nextRole,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            "Connecting took too long. Check the network and try again.",
          ),
        );
      }, 180_000);
    });
    let created: UserChainSession;
    try {
      created = await Promise.race([createPromise, timeoutPromise]);
    } catch (error) {
      // A timed out open may still land later. Close it when
      // it does, so it cannot hold the one wallet store.
      void createPromise
        .then((late) => late.wallet.stop())
        .catch(() => {});
      if (
        error instanceof Error &&
        error.message.includes("already in use")
      ) {
        throw new Error(
          "The wallet store is open in another tab of this site. Close the other tabs, then connect again.",
        );
      }
      throw error;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
    if (!sameKeyMaterial(openKeyMaterial(), materialAtStart)) {
      await created.wallet.stop().catch(() => {});
      throw new Error(
        "Your wallet was locked while connecting. Unlock it and connect again.",
      );
    }
    session = created;
  });
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
  if (session) {
    ensureBillIdOwner(session.account.toString());
  }
  const existing = billIds.get(webInvoiceId);
  if (existing !== undefined) {
    return existing;
  }
  const billId = nextBillId;
  nextBillId += 1;
  billIds.set(webInvoiceId, billId);
  return billId;
}

export interface ChainBillTarget {
  billId: number;
  workerAddress: string;
}

// Reserves the chain bill number for one local bill and
// returns it before any send, so the page can save the
// attempt on the bill. A retry after a cut off write then
// reuses this number instead of making a second bill.
export async function reserveInvoiceBillIdLive(
  webInvoiceId: string,
): Promise<ChainBillTarget | null> {
  if (!session) {
    return null;
  }
  if (session.userRole === "client") {
    throw new Error(
      "This wallet is connected to pay bills. Connect as worker to make bills.",
    );
  }
  throwIfUserWalletLocked();
  const workerAddress = session.account.toString();
  ensureBillIdOwner(workerAddress);
  const existing = billIds.get(webInvoiceId);
  if (existing !== undefined) {
    return { billId: existing, workerAddress };
  }
  const { readInvoiceCountOnChain } = await import("./invoiceChain");
  // A fresh page has an empty bill number map. Ask the
  // network how many bills this wallet already has, so the
  // next number cannot reuse one the network would reject.
  const count = await readInvoiceCountOnChain(session);
  const billId = Math.max(nextBillId, count + 1);
  billIds.set(webInvoiceId, billId);
  nextBillId = billId + 1;
  return { billId, workerAddress };
}

export async function createInvoiceLive(input: {
  webInvoiceId: string;
  amount: number;
  billId?: number;
}): Promise<ChainBillTarget | null> {
  if (!session) {
    return null;
  }
  if (session.userRole === "client") {
    throw new Error(
      "This wallet is connected to pay bills. Connect as worker to make bills.",
    );
  }
  throwIfUserWalletLocked();
  const activeSession = session;
  if (input.billId !== undefined) {
    ensureBillIdOwner(session.account.toString());
    billIds.set(input.webInvoiceId, input.billId);
    nextBillId = Math.max(nextBillId, input.billId + 1);
  }
  const target =
    input.billId !== undefined
      ? { billId: input.billId, workerAddress: session.account.toString() }
      : await reserveInvoiceBillIdLive(input.webInvoiceId);
  if (!target) {
    return null;
  }
  const { createInvoiceOnChain, readInvoiceMadeOnChain } = await import(
    "./invoiceChain"
  );
  // A retry after a lost reply can find the first write
  // already on the network. That is done, not a fault.
  const alreadyMade = await readInvoiceMadeOnChain(
    session,
    session.account,
    target.billId,
  ).catch(() => false);
  if (!alreadyMade) {
    if (session !== activeSession || !isWalletOpen()) {
      throw new Error(
        "Your wallet was locked while writing. Check My pay before sending a link.",
      );
    }
    await createInvoiceOnChain(session, {
      billId: target.billId,
      amount: input.amount,
      dueMark: 7,
    });
    if (session !== activeSession || !isWalletOpen()) {
      throw new Error(
        "Your wallet was locked while writing. Check My pay before sending a link.",
      );
    }
  }
  return target;
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

export async function checkInvoicePaidLive(input: {
  workerAddress: string;
  billId: number;
}): Promise<boolean | null> {
  if (!session || session.userRole !== "client") {
    return null;
  }
  throwIfUserWalletLocked();
  const { readInvoicePaidOnChain } = await import("./invoiceChain");
  const { AztecAddress } = await import("@aztec-labs/aztec.js/addresses");
  return readInvoicePaidOnChain(
    session,
    AztecAddress.schema.parse(input.workerAddress),
    input.billId,
  );
}

export interface BillPaymentView {
  invoiceId: string;
  billId: number;
  amount: number;
  paid: boolean;
}

// Checks the contract paid flag for each of this worker's
// network bills. A bill is only checked when its saved
// worker target is this session's wallet, so bills left by
// another wallet on this device are never marked from here.
export async function readMyBillPaymentsLive(
  bills: Invoice[],
): Promise<BillPaymentView[] | null> {
  if (!session || session.userRole !== "worker") {
    return null;
  }
  throwIfUserWalletLocked();
  const { readInvoicePaidOnChain } = await import("./invoiceChain");
  const mine = bills.filter(
    (bill) =>
      bill.chainBillId !== undefined &&
      bill.chainWorkerAddress === session!.account.toString(),
  );
  const views: BillPaymentView[] = [];
  for (const bill of mine) {
    const paid = await readInvoicePaidOnChain(
      session,
      session.account,
      bill.chainBillId!,
    );
    views.push({
      invoiceId: bill.id,
      billId: bill.chainBillId!,
      amount: bill.amount,
      paid,
    });
  }
  return views;
}

export async function checkMarkedProofLive(input: {
  claim: import("../domain/claim").SinglePaymentClaim;
  billId: number;
}): Promise<"valid" | "broken" | null> {
  if (!session) {
    return null;
  }
  if (!isWalletOpen()) {
    dropChainSession();
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
  // Marking a proof is a worker write. A client session or
  // a locked user wallet must not mark anything.
  if (session.userRole !== "worker" || !isWalletOpen()) {
    if (!isWalletOpen()) {
      dropChainSession();
    }
    return null;
  }
  return session;
}
