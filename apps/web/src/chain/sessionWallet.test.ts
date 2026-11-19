// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  connectedUserRole,
  dropChainSession,
  signInWithUserWallet,
  workerIsUserWallet,
} from "./session";
import {
  createUserWallet,
  lockUserWallet,
  openKeyMaterial,
} from "./userWallet";
import { WALLET_BOX_KEY } from "./keyVault";

function memoryStorage() {
  const raw = new Map<string, string>();
  return {
    raw,
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
  dropChainSession();
});

describe("user wallet session rules (Task 3)", () => {
  it("refuses to connect when the wallet is locked", async () => {
    await expect(signInWithUserWallet("worker")).rejects.toThrow(
      "Unlock your wallet first.",
    );
    expect(connectedUserRole()).toBeNull();
    expect(workerIsUserWallet()).toBe(false);
  });

  it("stored box holds no plain key material", async () => {
    const storage = memoryStorage();
    await createUserWallet("correct horse battery", storage);
    const material = openKeyMaterial();
    expect(material).not.toBeNull();
    const stored = storage.raw.get(WALLET_BOX_KEY) ?? "";
    expect(stored.startsWith("ppv1.")).toBe(true);
    expect(stored).not.toContain(material!.secret);
    expect(stored).not.toContain(material!.salt);
    expect(stored).not.toContain(material!.signingKey);
  });
});
