// @vitest-environment jsdom
// Role boundary at the session layer: a wallet must not pay
// its own bill even if a screen lets it try, and the
// already-written network check runs on retries only, never
// on a first send where the answer is known.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chain = vi.hoisted(() => ({
  made: false,
  madeChecks: 0,
  creates: 0,
  pays: 0,
}));

function fakeSession(role: string) {
  return {
    nodeUrl: "https://example.invalid",
    wallet: { stop: async () => {} },
    contract: {},
    account: { toString: () => `0x${"a".repeat(64)}` },
    fee: null,
    userRole: role,
    contractAddress: { toString: () => `0x${"a".repeat(64)}` },
  };
}

vi.mock("./wallet", () => ({
  createUserChainSession: async (
    _url: string,
    _material: unknown,
    role: string,
  ) => fakeSession(role),
}));

vi.mock("./invoiceChain", () => ({
  createInvoiceOnChain: async () => {
    chain.creates += 1;
  },
  readInvoiceMadeOnChain: async () => {
    chain.madeChecks += 1;
    return chain.made;
  },
  readInvoiceCountOnChain: async () => 0,
}));

vi.mock("./payChain", () => ({
  payInvoiceOnChain: async () => {
    chain.pays += 1;
    return { seconds: 1 };
  },
}));

import {
  connectedAccountAddress,
  createInvoiceLive,
  dropChainSession,
  payInvoiceLive,
  signInWithUserWallet,
} from "./session";
import { createUserWallet, lockUserWallet } from "./userWallet";

function memoryStorage() {
  const raw = new Map<string, string>();
  return {
    getItem: (key: string) => raw.get(key) ?? null,
    setItem: (key: string, value: string) => {
      raw.set(key, value);
    },
    removeItem: (key: string) => {
      raw.delete(key);
    },
  };
}

const OWN = `0x${"a".repeat(64)}`;
// A small value, so the real address parser accepts it.
const OTHER = `0x${"0".repeat(60)}babe`;

beforeEach(async () => {
  chain.made = false;
  chain.madeChecks = 0;
  chain.creates = 0;
  chain.pays = 0;
  lockUserWallet();
  await dropChainSession();
  await createUserWallet("correct horse battery", memoryStorage());
});

afterEach(async () => {
  await dropChainSession();
  lockUserWallet();
});

describe("session role boundary", () => {
  it("exposes the connected account address", async () => {
    await signInWithUserWallet("worker");
    expect(connectedAccountAddress()).toBe(OWN);
  });

  it("refuses a self pay before any chain call", async () => {
    await signInWithUserWallet("client");
    await expect(
      payInvoiceLive({
        webInvoiceId: "self-1",
        amount: 500,
        workerAddress: OWN,
        billId: 1,
      }),
    ).rejects.toThrow(/your own bill/);
    expect(chain.pays).toBe(0);
  });

  it("still pays another worker's bill", async () => {
    await signInWithUserWallet("client");
    const paid = await payInvoiceLive({
      webInvoiceId: "other-1",
      amount: 500,
      workerAddress: OTHER,
      billId: 1,
    });
    expect(paid).not.toBeNull();
    expect(chain.pays).toBe(1);
  });

  it("a first send makes no already-written check", async () => {
    await signInWithUserWallet("worker");
    await createInvoiceLive({
      webInvoiceId: "fresh-1",
      amount: 500,
      billId: 1,
      checkExisting: false,
    });
    expect(chain.madeChecks).toBe(0);
    expect(chain.creates).toBe(1);
  });

  it("a retry checks first and does not send again when the bill is already written", async () => {
    chain.made = true;
    await signInWithUserWallet("worker");
    const target = await createInvoiceLive({
      webInvoiceId: "retry-1",
      amount: 500,
      billId: 2,
      checkExisting: true,
    });
    expect(target?.billId).toBe(2);
    expect(chain.madeChecks).toBe(1);
    expect(chain.creates).toBe(0);
  });

  it("a call with a bill number and no retry word still checks (safe default)", async () => {
    chain.made = true;
    await signInWithUserWallet("worker");
    await createInvoiceLive({
      webInvoiceId: "default-1",
      amount: 500,
      billId: 3,
    });
    expect(chain.madeChecks).toBe(1);
    expect(chain.creates).toBe(0);
  });
});
