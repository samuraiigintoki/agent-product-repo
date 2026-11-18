import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { getInitialTestAccountsData } from "@aztec-labs/accounts/testing";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import type { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import artifactJson from "./payment_proof_artifact.json";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

export type Role = "worker" | "client" | "other";
export const ROLES: Role[] = ["worker", "client", "other"];

export interface ChainSession {
  nodeUrl: string;
  wallets: Record<Role, EmbeddedWallet>;
  accounts: Record<Role, AztecAddress>;
  contracts: Record<Role, Contract>;
  contractAddress: AztecAddress;
}

// Sign in is test accounts only, on the local network, with fake
// money. Each role gets its own wallet and private note store,
// following the official two wallet guide: before a wallet can
// see notes from a sender, it must register that sender, and
// before it can call a contract, it must register the contract.
export async function createChainSession(
  nodeUrl = "http://localhost:8080",
): Promise<ChainSession> {
  const node = createAztecNodeClient(nodeUrl);
  await waitForNode(node);

  const data = await getInitialTestAccountsData();
  const wallets = {} as Record<Role, EmbeddedWallet>;
  const accounts = {} as Record<Role, AztecAddress>;

  for (let i = 0; i < ROLES.length; i += 1) {
    const role = ROLES[i];
    const wallet = await EmbeddedWallet.create(node, {
      ephemeral: true,
      pxe: { proverEnabled: false },
    });
    const account = await wallet.createSchnorrInitializerlessAccount(
      data[i].secret,
      data[i].salt,
      data[i].signingKey,
    );
    wallets[role] = wallet;
    accounts[role] = account.address;
  }

  const { contract } = await Contract.deploy(wallets.worker, artifact, [])
    .send({ from: accounts.worker });

  const instance = await node.getContract(contract.address);
  if (!instance) {
    throw new Error("Contract was deployed but the node cannot see it.");
  }
  for (const role of ROLES) {
    if (role !== "worker") {
      await wallets[role].registerContract(instance, artifact);
    }
    // Every wallet registers every other account as a known sender,
    // so private notes sent between them can be found.
    for (const other of ROLES) {
      if (other !== role) {
        await wallets[role].registerSender(accounts[other], other);
      }
    }
  }

  const contracts = {} as Record<Role, Contract>;
  for (const role of ROLES) {
    contracts[role] = await Contract.at(contract.address, artifact, wallets[role]);
  }

  return {
    nodeUrl,
    wallets,
    accounts,
    contracts,
    contractAddress: contract.address,
  };
}
