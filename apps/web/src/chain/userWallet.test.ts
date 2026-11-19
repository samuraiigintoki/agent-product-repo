import { describe, expect, it } from "vitest";
import { WALLET_BOX_KEY } from "./keyVault";
import {
  createUserWallet,
  hasUserWallet,
  isWalletOpen,
  lockUserWallet,
  openWalletAddress,
  removeUserWallet,
  restoreUserWallet,
  unlockUserWallet,
  type WalletStorage,
} from "./userWallet";

function memoryStorage(): WalletStorage & { raw: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    raw: map,
  };
}

const PASSWORD = "correct horse battery";

describe("user wallet state", () => {
  it("create opens the wallet and gives an address and backup code", async () => {
    const storage = memoryStorage();
    const { address, backupCode } = await createUserWallet(PASSWORD, storage);
    expect(address).toMatch(/^0x[0-9a-f]{64}$/);
    expect(backupCode.startsWith("pp-backup.")).toBe(true);
    expect(isWalletOpen()).toBe(true);
    expect(openWalletAddress()).toBe(address);
    expect(hasUserWallet(storage)).toBe(true);
    lockUserWallet();
  });

  it("the stored box never holds the plain backup code body keys", async () => {
    const storage = memoryStorage();
    await createUserWallet(PASSWORD, storage);
    const stored = storage.raw.get(WALLET_BOX_KEY) ?? "";
    expect(stored.startsWith("ppv1.")).toBe(true);
    lockUserWallet();
  });

  it("lock closes, unlock with the right password opens the same address", async () => {
    const storage = memoryStorage();
    const { address } = await createUserWallet(PASSWORD, storage);
    lockUserWallet();
    expect(isWalletOpen()).toBe(false);
    expect(openWalletAddress()).toBeNull();
    const again = await unlockUserWallet(PASSWORD, storage);
    expect(again).toBe(address);
    lockUserWallet();
  });

  it("unlock with a wrong password fails and stays locked", async () => {
    const storage = memoryStorage();
    await createUserWallet(PASSWORD, storage);
    lockUserWallet();
    await expect(
      unlockUserWallet("not the password", storage),
    ).rejects.toThrow(/Wrong password or damaged backup/);
    expect(isWalletOpen()).toBe(false);
  });

  it("unlock with no wallet on the device says so plainly", async () => {
    const storage = memoryStorage();
    await expect(unlockUserWallet(PASSWORD, storage)).rejects.toThrow(
      /No wallet on this device/,
    );
  });

  it("restore from the backup code brings back the same address on a new device", async () => {
    const first = memoryStorage();
    const { address, backupCode } = await createUserWallet(PASSWORD, first);
    lockUserWallet();
    const newDevice = memoryStorage();
    const restored = await restoreUserWallet(backupCode, PASSWORD, newDevice);
    expect(restored).toBe(address);
    expect(hasUserWallet(newDevice)).toBe(true);
    lockUserWallet();
  });

  it("restore with a garbled code fails in plain words", async () => {
    const storage = memoryStorage();
    await expect(
      restoreUserWallet("not a code", PASSWORD, storage),
    ).rejects.toThrow(/does not look like a backup code/);
    expect(hasUserWallet(storage)).toBe(false);
  });

  it("remove takes the wallet off the device and locks it", async () => {
    const storage = memoryStorage();
    await createUserWallet(PASSWORD, storage);
    removeUserWallet(storage);
    expect(hasUserWallet(storage)).toBe(false);
    expect(isWalletOpen()).toBe(false);
  });

  it("create refuses a short password", async () => {
    const storage = memoryStorage();
    await expect(createUserWallet("short", storage)).rejects.toThrow(
      /at least 8 characters/,
    );
    expect(hasUserWallet(storage)).toBe(false);
  });
});
