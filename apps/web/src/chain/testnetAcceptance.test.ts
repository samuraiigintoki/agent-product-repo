// @vitest-environment node
// Slice acceptance run, scripted through the real app session
// code on the public test network. Two wallets in two
// separate storages stand in for two devices: worker A makes
// a bill through session calls, the version 2 link values are
// built the way the invoice page builds them, client B pays
// by those values through the session, then A reconnects
// fresh (as after a refresh) and reads the receipt back. The
// browser walk on the trial copy remains the owner step.
// Same env as the other testnet spikes. Keys never stored.
import { describe, expect, it } from "vitest";
import {
  billIdFor,
  chainWorkerAddress,
  createInvoiceLive,
  payInvoiceLive,
  readMyReceiptsLive,
  signInWithUserWallet,
} from "./session";
import {
  createUserWallet,
  lockUserWallet,
  unlockUserWallet,
} from "./userWallet";
import { dropChainSession } from "./session";
import type { BoxStorage } from "./keyVault";

function memoryStorage(): BoxStorage {
  const raw = new Map<string, string>();
  return {
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

function mark(label: string, since: number): number {
  const now = Date.now();
  console.log(`ACCEPT ${label}: ${Math.round((now - since) / 1000)}s`);
  return now;
}

describe("slice acceptance: two wallets, bill, pay, receipt", () => {
  it(
    "worker makes, client pays by link values, worker reads back after reconnect",
    async () => {
      const password = "correct horse battery";
      const storageA = memoryStorage();
      const storageB = memoryStorage();
      let t = Date.now();

      // Device one: worker wallet, connect, make a bill.
      await createUserWallet(password, storageA);
      await signInWithUserWallet("worker");
      t = mark("worker connected", t);
      await createInvoiceLive({ webInvoiceId: "accept-1", amount: 1250 });
      t = mark("bill written on chain", t);
      const workerAddress = chainWorkerAddress();
      expect(workerAddress).toBeTruthy();
      const billId = billIdFor("accept-1");

      // Device two: another wallet, pay by link values only.
      lockUserWallet();
      dropChainSession();
      await createUserWallet(password, storageB);
      await signInWithUserWallet("client");
      t = mark("client connected", t);
      const paid = await payInvoiceLive({
        webInvoiceId: "accept-1",
        amount: 1250,
        workerAddress: workerAddress!,
        billId,
      });
      t = mark("client paid", t);
      expect(paid).not.toBeNull();

      // Device one again, fresh connect as after a refresh.
      lockUserWallet();
      dropChainSession();
      await unlockUserWallet(password, storageA);
      await signInWithUserWallet("worker");
      t = mark("worker reconnected", t);
      const view = await readMyReceiptsLive();
      t = mark("receipts read", t);
      expect(view).not.toBeNull();
      expect(view!.count).toBe(1);
      expect(view!.billId).toBe(billId);
      expect(view!.amount).toBe(1250);
    },
    1_800_000,
  );
});
