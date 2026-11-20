// @vitest-environment jsdom
// In a browser where OPFS refuses and IndexedDB cannot
// open either (jsdom has no IndexedDB), the store choice
// must fail with the plain storage message, never with the
// raw browser words.
import { afterEach, describe, expect, it } from "vitest";
import { BROWSER_STORAGE_MESSAGE, chainStoreOverrides } from "./browserStore";

const original = Object.getOwnPropertyDescriptor(
  window.navigator,
  "storage",
);

afterEach(() => {
  if (original) {
    Object.defineProperty(window.navigator, "storage", original);
  } else {
    delete (window.navigator as { storage?: unknown }).storage;
  }
});

describe("store choice in a refusing browser", () => {
  it("fails in plain words when no storage can open", async () => {
    Object.defineProperty(window.navigator, "storage", {
      configurable: true,
      value: {
        getDirectory: async () => {
          const error = new Error(
            "Security error when calling GetDirectory",
          );
          error.name = "SecurityError";
          throw error;
        },
      },
    });
    await expect(chainStoreOverrides()).rejects.toThrow(
      BROWSER_STORAGE_MESSAGE,
    );
    await chainStoreOverrides().catch((error: unknown) => {
      expect(String(error)).not.toContain("GetDirectory");
    });
  });
});
