// Storage choice rules, tested without a browser. The
// browser-only open paths are covered in
// browserStoreJsdom.test.ts and by the trial copy walk.
import { describe, expect, it } from "vitest";
import {
  BROWSER_STORAGE_MESSAGE,
  chainStoreOverrides,
  detectOpfs,
  isBrowserStorageError,
  plainChainError,
} from "./browserStore";

function firefoxStorageError(): Error {
  const error = new Error("Security error when calling GetDirectory");
  error.name = "SecurityError";
  return error;
}

describe("browser storage errors", () => {
  it("recognises browser storage refusals", () => {
    expect(isBrowserStorageError(firefoxStorageError())).toBe(true);
    expect(
      isBrowserStorageError(new Error("Failed to execute 'getDirectory'")),
    ).toBe(true);
    expect(isBrowserStorageError({ name: "SecurityError" })).toBe(true);
  });

  it("does not mistake other failures for storage refusals", () => {
    expect(
      isBrowserStorageError(new Error("The network cannot be reached")),
    ).toBe(false);
    expect(isBrowserStorageError(new Error("store already in use"))).toBe(
      false,
    );
    expect(isBrowserStorageError("plain text")).toBe(false);
  });

  it("turns storage refusals into the plain message and passes other errors through", () => {
    expect(plainChainError(firefoxStorageError()).message).toBe(
      BROWSER_STORAGE_MESSAGE,
    );
    expect(plainChainError(firefoxStorageError()).message).not.toContain(
      "GetDirectory",
    );
    const other = new Error("The network cannot be reached");
    expect(plainChainError(other)).toBe(other);
  });
});

describe("opfs detection", () => {
  it("is true when the entry point opens", async () => {
    await expect(detectOpfs(async () => ({}))).resolves.toBe(true);
  });

  it("is false when the browser refuses", async () => {
    await expect(
      detectOpfs(async () => {
        throw firefoxStorageError();
      }),
    ).resolves.toBe(false);
  });

  it("is false when there is no entry point", async () => {
    // The Node test environment has no OPFS entry point.
    await expect(detectOpfs()).resolves.toBe(false);
  });
});

describe("store overrides outside a browser", () => {
  it("is null where there is no document (Node test runs)", async () => {
    await expect(chainStoreOverrides()).resolves.toBeNull();
  });
});
