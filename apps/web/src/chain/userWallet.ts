import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import { getSchnorrInitializerlessAccountContractAddress } from "@aztec-labs/accounts/schnorr";
import {
  clearSealedBox,
  createKeyMaterial,
  loadSealedBox,
  openBackupCode,
  openSealedBox,
  saveSealedBox,
  sealKeyMaterial,
  toBackupCode,
  type BoxStorage,
  type KeyMaterial,
} from "./keyVault";

// The user's own wallet, as state. The sealed box lives in
// browser storage. Plain key material lives in this module's
// memory only while the wallet is open, and is dropped on
// lock. The address is public, so it may be shown freely; it
// is worked out on the device from the keys, with no network.

export type WalletStorage = BoxStorage;

let openMaterial: KeyMaterial | null = null;
let openAddress: string | null = null;

export async function deriveWalletAddress(
  material: KeyMaterial,
): Promise<string> {
  const address = await getSchnorrInitializerlessAccountContractAddress(
    Fq.fromString(material.signingKey),
    Fr.fromString(material.salt),
    Fr.fromString(material.secret),
  );
  return address.toString();
}

function defaultStorage(): WalletStorage {
  return window.localStorage;
}

export function hasUserWallet(
  storage: WalletStorage = defaultStorage(),
): boolean {
  return loadSealedBox(storage) !== null;
}

export function isWalletOpen(): boolean {
  return openMaterial !== null;
}

export function openWalletAddress(): string | null {
  return openAddress;
}

// Plain key material for chain work (Task 4). Memory only.
// Never log this, never store it, never send it anywhere.
export function openKeyMaterial(): KeyMaterial | null {
  return openMaterial;
}

async function openWith(material: KeyMaterial): Promise<string> {
  openMaterial = material;
  try {
    openAddress = await deriveWalletAddress(material);
  } catch {
    // The address is a display value. If the address math
    // cannot run here, the wallet still opens; the address is
    // worked out again when the chain session connects (Task 4
    // registers the account with the wallet there).
    openAddress = null;
  }
  return openAddress ?? "";
}

export async function createUserWallet(
  password: string,
  storage: WalletStorage = defaultStorage(),
): Promise<{ address: string; backupCode: string }> {
  const material = createKeyMaterial();
  const box = await sealKeyMaterial(material, password);
  saveSealedBox(storage, box);
  const address = await openWith(material);
  return { address, backupCode: toBackupCode(box) };
}

export async function unlockUserWallet(
  password: string,
  storage: WalletStorage = defaultStorage(),
): Promise<string> {
  const box = loadSealedBox(storage);
  if (box === null) {
    throw new Error("No wallet on this device yet.");
  }
  const material = await openSealedBox(box, password);
  return openWith(material);
}

export async function restoreUserWallet(
  backupCode: string,
  password: string,
  storage: WalletStorage = defaultStorage(),
): Promise<string> {
  const material = await openBackupCode(backupCode, password);
  const box = await sealKeyMaterial(material, password);
  saveSealedBox(storage, box);
  return openWith(material);
}

export function lockUserWallet(): void {
  openMaterial = null;
  openAddress = null;
}

export function removeUserWallet(
  storage: WalletStorage = defaultStorage(),
): void {
  clearSealedBox(storage);
  lockUserWallet();
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}
