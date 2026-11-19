// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sponsoredFeeAddress } from "./feeSponsor";

describe("fee sponsor", () => {
  it("finds the same sponsor address every time, with no network", async () => {
    const first = await sponsoredFeeAddress();
    const second = await sponsoredFeeAddress();
    expect(first).toMatch(/^0x[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });
});
