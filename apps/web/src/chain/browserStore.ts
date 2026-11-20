import type { AztecAsyncKVStore } from "@aztec-labs/kv-store/interfaces";

// One place that decides how the wallet engine stores its
// working data in a browser, and what a person is told
// when the browser refuses storage.
//
// The wallet engine normally keeps its data in OPFS, a
// browser storage area. Some browsers refuse that area:
// Firefox private windows, browsers set to block site
// data, and pages whose origin cannot hold storage all
// refuse it with a SecurityError. When that happens the
// engine is given the IndexedDB store from the pinned
// Aztec packages instead. Same device, same site, same
// data, nothing leaves the device, and key handling does
// not change. When neither store can open, connecting
// stops with the plain message below. Raw browser
// storage errors never reach a screen.

export const BROWSER_STORAGE_MESSAGE =
  "This browser is blocking the storage the wallet needs. Leave private browsing, or allow site data for this site, or try a current Chrome, Edge, or Firefox window. Then try again.";

const STORAGE_ERROR_WORDS = [
  "getdirectory",
  "securityerror",
  "security error",
  "opfs",
];

export function isBrowserStorageError(error: unknown): boolean {
  // Browser storage refusals arrive as DOMExceptions, which
  // are not Error instances in every browser, so read the
  // name and message off any object that carries them.
  const shaped = error as { name?: unknown; message?: unknown } | null;
  const name = typeof shaped?.name === "string" ? shaped.name : "";
  const message = typeof shaped?.message === "string" ? shaped.message : "";
  const text = `${name} ${message}`.toLowerCase();
  return STORAGE_ERROR_WORDS.some((word) => text.includes(word));
}

export function plainChainError(error: unknown): Error {
  if (isBrowserStorageError(error)) {
    return new Error(BROWSER_STORAGE_MESSAGE);
  }
  return error instanceof Error ? error : new Error("Something went wrong.");
}

// Probes the OPFS entry point. A probe can be passed in by
// tests; the real one asks the browser for its private
// storage root, which is the call refusing browsers throw
// on.
export async function detectOpfs(
  probe?: () => Promise<unknown>,
): Promise<boolean> {
  const ask =
    probe ??
    (async () => {
      const storage = (
        globalThis as { navigator?: { storage?: unknown } }
      ).navigator?.storage as
        | { getDirectory?: () => Promise<unknown> }
        | undefined;
      if (!storage?.getDirectory) {
        throw new Error("No OPFS entry point.");
      }
      return storage.getDirectory();
    });
  try {
    await ask();
    return true;
  } catch {
    return false;
  }
}

export interface ChainStoreOverrides {
  pxeStore: AztecAsyncKVStore;
  walletStore: AztecAsyncKVStore;
}

// Returns null when the engine should use its normal
// stores: outside a browser (the Node test path), or in a
// browser where OPFS opens. In a browser where OPFS
// refuses, opens the IndexedDB stores instead. The PXE
// store keeps the normal name so a returning person finds
// the same data; the wallet store is temporary, matching
// the lifetime of the wallet store the engine opens for
// itself today.
export async function chainStoreOverrides(): Promise<ChainStoreOverrides | null> {
  if (typeof document === "undefined") {
    return null;
  }
  if (await detectOpfs()) {
    return null;
  }
  try {
    const { AztecIndexedDBStore } = await import(
      "@aztec-labs/kv-store/deprecated/indexeddb"
    );
    const { createLogger } = await import("@aztec-labs/foundation/log");
    const pxeStore = await AztecIndexedDBStore.open(
      createLogger("pxe:data"),
      "pxe_data",
      false,
    );
    const walletStore = await AztecIndexedDBStore.open(
      createLogger("wallet:data"),
      undefined,
      true,
    );
    return { pxeStore, walletStore };
  } catch {
    throw new Error(BROWSER_STORAGE_MESSAGE);
  }
}
