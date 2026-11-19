import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";

// The key box. A user's key material is made on this device,
// sealed with their password, and only the sealed box is ever
// stored or shown as a backup code. Plain keys live in memory
// only while the wallet is open, and never touch logs, storage,
// or the network. Losing the password AND the backup code
// means the wallet is gone. The screens must say that first.

export interface KeyMaterial {
  secret: string;
  salt: string;
  signingKey: string;
}

export const WALLET_BOX_KEY = "private-pay-proof.wallet.v1";
const BACKUP_PREFIX = "pp-backup.";
const BOX_VERSION = "ppv1";
const PBKDF2_ROUNDS = 210_000;
const MIN_PASSWORD_LENGTH = 8;

export function createKeyMaterial(): KeyMaterial {
  // Fr and Fq random come from the device random source and
  // always land inside the valid range for account keys.
  return {
    secret: Fr.random().toString(),
    salt: Fr.random().toString(),
    signingKey: Fq.random().toString(),
  };
}

function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("Password must be at least 8 characters.");
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function lockKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ROUNDS,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Box shape: ppv1.<salt>.<iv>.<sealed>, each part base64. The
// sealed part also proves itself: AES-GCM refuses to open if
// one byte changed or the password is wrong.
export async function sealKeyMaterial(
  material: KeyMaterial,
  password: string,
): Promise<string> {
  checkPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await lockKey(password, salt);
  const plain = new TextEncoder().encode(JSON.stringify(material));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain),
  );
  return [BOX_VERSION, toBase64(salt), toBase64(iv), toBase64(sealed)].join(".");
}

export async function openSealedBox(
  box: string,
  password: string,
): Promise<KeyMaterial> {
  checkPassword(password);
  try {
    const [version, saltText, ivText, sealedText] = box.split(".");
    if (version !== BOX_VERSION || !saltText || !ivText || !sealedText) {
      throw new Error("bad box");
    }
    const key = await lockKey(password, fromBase64(saltText));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivText) as BufferSource },
      key,
      fromBase64(sealedText) as BufferSource,
    );
    const material = JSON.parse(
      new TextDecoder().decode(plain),
    ) as KeyMaterial;
    if (!material.secret || !material.salt || !material.signingKey) {
      throw new Error("bad box");
    }
    return material;
  } catch {
    // One plain message for every failure. Saying which part
    // failed would help a thief more than the owner.
    throw new Error("Wrong password or damaged backup.");
  }
}

// The backup code is the sealed box with a name tag, so a user
// can copy it to paper or a password manager. It is still
// sealed: the code alone opens nothing without the password.
export function toBackupCode(box: string): string {
  return `${BACKUP_PREFIX}${box}`;
}

export async function openBackupCode(
  code: string,
  password: string,
): Promise<KeyMaterial> {
  const trimmed = code.trim();
  const body = trimmed.startsWith(BACKUP_PREFIX)
    ? trimmed.slice(BACKUP_PREFIX.length)
    : "";
  if (!body.startsWith(`${BOX_VERSION}.`)) {
    throw new Error("That does not look like a backup code.");
  }
  return openSealedBox(body, password);
}

export interface BoxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveSealedBox(storage: BoxStorage, box: string): void {
  storage.setItem(WALLET_BOX_KEY, box);
}

export function loadSealedBox(storage: BoxStorage): string | null {
  return storage.getItem(WALLET_BOX_KEY);
}

export function clearSealedBox(storage: BoxStorage): void {
  storage.removeItem(WALLET_BOX_KEY);
}
