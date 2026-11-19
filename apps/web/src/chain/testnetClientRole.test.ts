// @vitest-environment node
// Live check for Task 3 wiring, on the public test network.
// A stranger worker wallet (built directly, like the Task 2
// spike) makes a bill. The client pays through the real app
// session code (createChainSession with the user wallet in
// the client role, then payInvoiceOnChain to the worker
// address). The worker then reads the receipt back with its
// own wallet. Run on its own with the same env as
// testnetSpike.test.ts. Keys are fresh and never stored.
import { describe, expect, it } from "vitest";
import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import artifactJson from "./payment_proof_artifact.json";
import { AZTEC_CONTRACT_ADDRESS, AZTEC_NODE_URL } from "./settings";
import { createKeyMaterial } from "./keyVault";
import { deriveWalletAddress } from "./userWallet";
import { actorFor, createChainSession } from "./wallet";
import { payInvoiceOnChain } from "./payChain";
import { sponsoredFeeFor } from "./feeSponsor";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

describe("client role session pays a stranger worker (Task 3 live)", () => {
  it(
    "session client pays, stranger worker reads the receipt",
    async () => {
      expect(AZTEC_CONTRACT_ADDRESS).not.toBe("");
      const node = createAztecNodeClient(AZTEC_NODE_URL);
      await waitForNode(node);
      const contractAddress = AztecAddress.schema.parse(AZTEC_CONTRACT_ADDRESS);
      const instance = await node.getContract(contractAddress);
      if (!instance) {
        throw new Error("Pinned contract not seen on this network.");
      }

      // Stranger worker, its own wallet program.
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
      console.log(`CLIENTROLE worker made bill ${billId}`);

      // The real app session, user wallet in the client role.
      const material = createKeyMaterial();
      const clientAddress = await deriveWalletAddress(material);
      const session = await createChainSession(AZTEC_NODE_URL, material, "client");
      expect(session.userRole).toBe("client");
      expect(session.accounts.client.toString()).toBe(clientAddress);
      expect(session.clientFee).not.toBeNull();

      const paid = await payInvoiceOnChain(actorFor(session, "client"), {
        worker: workerAccount.address,
        billId,
        amount: 1250,
        payerMark: 99,
      });
      console.log(`CLIENTROLE paid in about ${paid.seconds}s`);

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
