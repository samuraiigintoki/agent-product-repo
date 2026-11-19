// @vitest-environment node
// Task 1 spike for the real flow plan. NOT product proof. It
// answers one question with real numbers: can a fresh wallet,
// built the way the browser builds it (real proving on), send
// one bill on the public test network with the sponsor paying
// the fee, and read the state back. Run on its own:
//   VITE_AZTEC_NODE_URL=https://aztec-testnet.drpc.org \
//   VITE_AZTEC_CONTRACT_ADDRESS=0x11705ef50a419c77464ad3e0546ef55fd34a5bce800fad03fd51762f45df9946 \
//   npx vitest run src/chain/testnetSpike.test.ts
// Keys are fresh random values in memory only. Nothing is
// stored, logged (keys never print), or reused.
import { describe, expect, it } from "vitest";
import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import artifactJson from "./payment_proof_artifact.json";
import { AZTEC_CONTRACT_ADDRESS, AZTEC_NODE_URL } from "./settings";
import { sponsoredFeeFor, sponsoredFeeAddress } from "./feeSponsor";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

function mark(label: string, since: number): number {
  const now = Date.now();
  console.log(`SPIKE ${label}: ${Math.round((now - since) / 1000)}s`);
  return now;
}

describe("public test network spike (Task 1)", () => {
  it(
    "fresh wallet sends one bill with sponsored fee and reads it back",
    async () => {
      expect(AZTEC_CONTRACT_ADDRESS).not.toBe("");
      let t = Date.now();
      const node = createAztecNodeClient(AZTEC_NODE_URL);
      await waitForNode(node);
      t = mark("node ready", t);
      console.log(`SPIKE sponsor should be: ${await sponsoredFeeAddress()}`);

      const wallet = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxe: { proverEnabled: true },
      });
      t = mark("wallet made", t);

      const account = await wallet.createSchnorrInitializerlessAccount(
        Fr.random(),
        Fr.random(),
        Fq.random(),
      );
      t = mark("account made", t);
      console.log(`SPIKE fresh address: ${account.address.toString()}`);

      const fee = await sponsoredFeeFor(wallet);
      t = mark("sponsor registered", t);

      const contractAddress = AztecAddress.schema.parse(AZTEC_CONTRACT_ADDRESS);
      const instance = await node.getContract(contractAddress);
      if (!instance) {
        throw new Error("Pinned contract not seen on this network.");
      }
      await wallet.registerContract(instance, artifact);
      const contract = await Contract.at(contractAddress, artifact, wallet);
      t = mark("contract registered", t);

      const billId = Math.floor(100000 + Math.random() * 900000);
      await contract.methods
        .create_invoice(billId, 1250, 7)
        .send({ from: account.address, fee: { paymentMethod: fee } });
      t = mark(`create_invoice landed (bill ${billId})`, t);

      const { result } = await contract.methods
        .read_receipts(account.address)
        .simulate({ from: account.address });
      t = mark("read_receipts simulated", t);
      const fields = result as unknown[];
      console.log(
        `SPIKE receipts count: ${String(fields[0])} bill: ${String(fields[1])} amount: ${String(fields[2])}`,
      );
      expect(result).toBeTruthy();
    },
    1_800_000,
  );
});
