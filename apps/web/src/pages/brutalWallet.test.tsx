// @vitest-environment jsdom
// Brutal campaign: damaged wallet box recovery, end to end.
// A wallet is made for real (sealed box, real backup code),
// the stored box is then damaged, and the panel must still
// restore the same wallet from the backup code or remove
// the box. Keys never leave the test storages.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WalletPanel from "./WalletPanel";
import {
  createUserWallet,
  hasUserWallet,
  isWalletOpen,
  lockUserWallet,
  openKeyMaterial,
  type WalletStorage,
} from "../chain/userWallet";
import { WALLET_BOX_KEY } from "../chain/keyVault";
import { dropChainSession } from "../chain/session";

function memoryStorage(): WalletStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

beforeEach(() => {
  lockUserWallet();
  void dropChainSession();
});
afterEach(cleanup);

describe("brutal campaign: damaged wallet recovery", () => {
  it("restores the same wallet from its backup code over a damaged box", async () => {
    const storage = memoryStorage();
    const created = await createUserWallet("correct horse battery", storage);
    const material = openKeyMaterial();
    expect(material).not.toBeNull();
    lockUserWallet();
    expect(openKeyMaterial()).toBeNull();

    storage.raw.set(WALLET_BOX_KEY, "damaged beyond reading");
    render(<WalletPanel storage={storage} />);

    fireEvent.change(screen.getByLabelText(/Backup code/), {
      target: { value: created.backupCode },
    });
    fireEvent.change(screen.getByLabelText(/Password for that backup/), {
      target: { value: "correct horse battery" },
    });
    // First press arms the replace warning; second confirms.
    fireEvent.click(screen.getByRole("button", { name: "Restore my wallet" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, restore over this wallet" }),
    );

    expect(await screen.findByText(/Wallet restored and open/)).toBeTruthy();
    expect(isWalletOpen()).toBe(true);
    // The same key material came back: this is the same
    // wallet, not a fresh one wearing its backup code.
    expect(openKeyMaterial()?.secret).toBe(material?.secret);
    expect(openKeyMaterial()?.signingKey).toBe(material?.signingKey);
  });

  it("removes a damaged box after a confirm, and a wrong backup restores nothing", async () => {
    const storage = memoryStorage();
    const created = await createUserWallet("correct horse battery", storage);
    lockUserWallet();
    storage.raw.set(WALLET_BOX_KEY, "ppv1.torn.in.half");
    render(<WalletPanel storage={storage} />);

    fireEvent.change(screen.getByLabelText(/Backup code/), {
      target: { value: `${created.backupCode}tampered` },
    });
    fireEvent.change(screen.getByLabelText(/Password for that backup/), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore my wallet" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, restore over this wallet" }),
    );
    expect(
      await screen.findByText(/Wrong password or damaged backup/),
    ).toBeTruthy();
    expect(isWalletOpen()).toBe(false);
    expect(hasUserWallet(storage)).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove wallet from this device" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove it" }));
    expect(hasUserWallet(storage)).toBe(false);
    expect(
      await screen.findByText(/Wallet removed from this device/),
    ).toBeTruthy();
  });
});
