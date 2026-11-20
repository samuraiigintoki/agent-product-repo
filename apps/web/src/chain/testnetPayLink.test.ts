// @vitest-environment node
// Live check for Task 4 wiring, public test network. A
// stranger worker makes a bill. The client connects through
// the real app session (user wallet, client role) and pays
// by handing payInvoiceLive exactly what a version 2 pay
// link carries: worker address plus chain bill number. The
// worker reads the receipt back. Same env as the other
// testnet spikes. Keys are fresh and never stored.
import { describe, expect, it } from "vitest";
import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import artifactJson from "./payment_proof_artifact.json";
import { AZTEC_CONTRACT_ADDRESS, AZTEC_NODE_URL } from "./settings";
import { createUserWallet } from "./userWallet";
import { payInvoiceLive, signInWithUserWallet } from "./session";
import { sponsoredFeeFor } from "./feeSponsor";
import type { BoxStorage } from "./keyVault";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

function memoryStorage(): BoxStorage {
  const raw = new Map<string, string>();
  return {
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
    removeItem: (key) => {
      raw.delete(key);
    },
  };
}

describe("version 2 link pay through the app session (Task 4 live)", () => {
  it(
    "client session pays a stranger worker by link values",
    async () => {
      expect(AZTEC_CONTRACT_ADDRESS).not.toBe("");
      const node = createAztecNodeClient(AZTEC_NODE_URL);
      await waitForNode(node);
      const contractAddress = AztecAddress.schema.parse(AZTEC_CONTRACT_ADDRESS);
      const instance = await node.getContract(contractAddress);
      if (!instance) {
        throw new Error("Pinned contract not seen on this network.");
      }

      const workerWallet = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxe: { proverEnabled: true },
      });
      const workerAccount = await workerWallet.createSchnorrInitializerlessAccount(
        Fr.random(),
        Fr.random(),
        Fq.random(),
      );
      await workerWallet.registerContract(instance, artifact);
      const workerFee = await sponsoredFeeFor(workerWallet);
      const workerContract = await Contract.at(contractAddress, artifact, workerWallet);

      const billId = Math.floor(100000 + Math.random() * 900000);
      await workerContract.methods
        .create_invoice(billId, 1250, 7)
        .send({ from: workerAccount.address, fee: { paymentMethod: workerFee } });
      console.log(`PAYLINK worker made bill ${billId}`);

      await createUserWallet("correct horse battery", memoryStorage());
      await signInWithUserWallet("client");
      const paid = await payInvoiceLive({
        webInvoiceId: "link-bill-1",
        amount: 1250,
        workerAddress: workerAccount.address.toString(),
        billId,
      });
      console.log(`PAYLINK paid in about ${paid?.seconds ?? "?"}s`);
      expect(paid).not.toBeNull();

      const { result } = await workerContract.methods
        .read_receipts(workerAccount.address)
        .simulate({ from: workerAccount.address });
      const fields = result as unknown[];
      expect(Number(fields[0])).toBe(1);
      expect(Number(fields[1])).toBe(billId);
      expect(Number(fields[2])).toBe(1250);
    },
    1_800_000,
  );
});
