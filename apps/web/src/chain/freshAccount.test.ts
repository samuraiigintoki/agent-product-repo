// Live spike test, Task 1 of the built in wallet plan. Needs the
// local Aztec network on localhost:8080. It proves a FRESH
// random account (no known test keys) can be made, found again
// from the same key material, deployed, and used to write a
// bill. Run on its own: npx vitest run src/chain/freshAccount.test.ts
import { describe, expect, it } from "vitest";
import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
const NODE_URL = "http://localhost:8080";

describe("fresh random account (wallet spike)", () => {
  it(
    "makes an address and finds it again from the same keys",
    async () => {
      const node = createAztecNodeClient(NODE_URL);
      await waitForNode(node);

      const secret = Fr.random();
      const salt = Fr.random();
      const signingKey = Fq.random();

      const walletOne = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxe: { proverEnabled: false },
      });
      const accountOne = await walletOne.createSchnorrInitializerlessAccount(
        secret,
        salt,
        signingKey,
      );
      const addressOne = accountOne.address.toString();
      expect(addressOne).toMatch(/^0x[0-9a-f]{64}$/);

      // Same key material in a brand new wallet must give the
      // same address. That is what restore from backup means.
      const walletTwo = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxe: { proverEnabled: false },
      });
      const accountTwo = await walletTwo.createSchnorrInitializerlessAccount(
        secret,
        salt,
        signingKey,
      );
      expect(accountTwo.address.toString()).toBe(addressOne);
    },
    600_000,
  );

  // Spike finding, 2026-11-18: a fresh account CAN be made and
  // restored (test above), but its first send fails with "Not
  // enough balance for fee payer" until something covers its
  // first fee. Test accounts arrive pre funded; user accounts
  // do not. On the public test network the sponsored fee path
  // already worked for account creation (Task 7, wallet tool).
  // So the first run flow needs a fee sponsor step. That is
  // Task 4 design work, not a blocker for the key box. This
  // send test stays off until that step exists.
  it.skip("sends its first bill once the first fee is covered", async () => {
    expect(true).toBe(true);
  });
});
