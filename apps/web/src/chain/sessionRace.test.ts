// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chain = vi.hoisted(() => ({
  mode: "deferred" as "deferred" | "record",
  resolveCreate: undefined as ((session: unknown) => void) | undefined,
  resolveStop: undefined as (() => void) | undefined,
  stopDone: false,
  events: [] as string[],
}));

function fakeSession(role: string, stoppable = false) {
  return {
    nodeUrl: "https://example.invalid",
    wallet: {
      stop: async () => {
        if (!stoppable) {
          return;
        }
        await new Promise<void>((done) => {
          chain.resolveStop = () => {
            chain.stopDone = true;
            done();
          };
        });
      },
    },
    contract: {},
    account: { toString: () => `0x${"a".repeat(64)}` },
    fee: null,
    userRole: role,
    contractAddress: { toString: () => `0x${"a".repeat(64)}` },
  };
}

vi.mock("./wallet", () => ({
  createUserChainSession: async (_url: string, _material: unknown, role: string) => {
    if (chain.mode === "deferred") {
      return new Promise((done) => {
        chain.resolveCreate = done;
      });
    }
    chain.events.push(`create-${role}-after-stop=${chain.stopDone}`);
    return fakeSession(role);
  },
}));

import {
  connectedUserRole,
  dropChainSession,
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

beforeEach(() => {
  lockUserWallet();
  void dropChainSession();
  chain.events = [];
  chain.stopDone = false;
  chain.mode = "deferred";
});

afterEach(async () => {
  chain.resolveStop?.();
  await dropChainSession();
  lockUserWallet();
});

describe("session change races", () => {
  it("does not finish connecting after the wallet was locked", async () => {
    await createUserWallet("correct horse battery", memoryStorage());
    const pending = signInWithUserWallet("worker");
    await new Promise((done) => setTimeout(done, 0));

    lockUserWallet();
    chain.resolveCreate?.(fakeSession("worker"));
    await expect(pending).rejects.toThrow(/locked while connecting/);
    expect(connectedUserRole()).toBeNull();
  });

  it("does not open a new wallet store before the old one has closed", async () => {
    await createUserWallet("correct horse battery", memoryStorage());
    const first = signInWithUserWallet("worker");
    await new Promise((done) => setTimeout(done, 0));
    chain.resolveCreate?.(fakeSession("worker", true));
    await first;

    chain.mode = "record";
    void dropChainSession();
    const second = signInWithUserWallet("client");
    await new Promise((done) => setTimeout(done, 20));
    expect(chain.events).toEqual([]);

    chain.resolveStop?.();
    await second;
    expect(chain.events).toEqual(["create-client-after-stop=true"]);
    expect(connectedUserRole()).toBe("client");
  });
});
