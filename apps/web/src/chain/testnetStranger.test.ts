// @vitest-environment node
// Task 2 spike for the real flow plan. NOT product proof. Two
// fresh wallets in two separate wallet programs that have
// never met and share nothing. Wallet A (worker) makes a bill.
// Wallet B (client) pays it knowing only A address and the
// bill number. Then we learn what A needs to find the receipt:
// nothing, time, or learning B address first.
// Run on its own with the same env as testnetSpike.test.ts.
// Keys are fresh random values in memory only.
import { describe, expect, it } from "vitest";
import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import artifactJson from "./payment_proof_artifact.json";
import { AZTEC_CONTRACT_ADDRESS, AZTEC_NODE_URL } from "./settings";
import { sponsoredFeeFor } from "./feeSponsor";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

function mark(label: string, since: number): number {
  const now = Date.now();
  console.log(`STRANGER ${label}: ${Math.round((now - since) / 1000)}s`);
  return now;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("two wallets that have never met (Task 2)", () => {
  it(
    "stranger pays, worker learns what finding the receipt takes",
    async () => {
      expect(AZTEC_CONTRACT_ADDRESS).not.toBe("");
      let t = Date.now();
      const node = createAztecNodeClient(AZTEC_NODE_URL);
      await waitForNode(node);

      const contractAddress = AztecAddress.schema.parse(AZTEC_CONTRACT_ADDRESS);
      const instance = await node.getContract(contractAddress);
      if (!instance) {
        throw new Error("Pinned contract not seen on this network.");
      }

      async function freshWallet(label: string) {
        const wallet = await EmbeddedWallet.create(node, {
          ephemeral: true,
          pxe: { proverEnabled: true },
        });
        const account = await wallet.createSchnorrInitializerlessAccount(
          Fr.random(),
          Fr.random(),
          Fq.random(),
        );
        await wallet.registerContract(instance!, artifact);
        const fee = await sponsoredFeeFor(wallet);
        const contract = await Contract.at(contractAddress, artifact, wallet);
        console.log(`STRANGER ${label} address: ${account.address.toString()}`);
        return { wallet, account, fee, contract };
      }

      const a = await freshWallet("worker A");
      const b = await freshWallet("client B");
      t = mark("both wallets made", t);

      const billId = Math.floor(100000 + Math.random() * 900000);
      await a.contract.methods
        .create_invoice(billId, 1250, 7)
        .send({ from: a.account.address, fee: { paymentMethod: a.fee } });
      t = mark(`A made bill ${billId}`, t);

      const paidBlock = await node.getBlockNumber();
      await b.contract.methods
        .pay_invoice(a.account.address, billId, 1250, 99, paidBlock)
        .send({ from: b.account.address, fee: { paymentMethod: b.fee } });
      t = mark("B paid, knowing only A address and bill number", t);

      async function readCount(label: string): Promise<number> {
        const { result } = await a.contract.methods
          .read_receipts(a.account.address)
          .simulate({ from: a.account.address });
        const fields = result as unknown[];
        const count = Number(fields[0]);
        console.log(
          `STRANGER A receipts at ${label}: count ${count} bill ${String(fields[1])} amount ${String(fields[2])}`,
        );
        return count;
      }

      let count = await readCount("first look");
      if (count === 0) {
        await sleep(30_000);
        count = await readCount("after 30s wait");
      }
      if (count === 0) {
        await a.wallet.registerSender(b.account.address, "client");
        await sleep(30_000);
        count = await readCount("after A learned B address and waited");
      }
      t = mark("final read", t);
      expect(count).toBe(1);
    },
    1_800_000,
  );
});
