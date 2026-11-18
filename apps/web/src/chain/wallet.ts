import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { getInitialTestAccountsData } from "@aztec-labs/accounts/testing";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import type { FeePaymentMethod } from "@aztec-labs/aztec.js/fee";
import artifactJson from "./payment_proof_artifact.json";
import { AZTEC_CONTRACT_ADDRESS, AZTEC_NODE_URL } from "./settings";
import { sponsoredFeeFor } from "./feeSponsor";
import type { KeyMaterial } from "./keyVault";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

export type Role = "worker" | "client" | "other";
export const ROLES: Role[] = ["worker", "client", "other"];

export interface ChainSession {
  nodeUrl: string;
  wallets: Record<Role, EmbeddedWallet>;
  accounts: Record<Role, AztecAddress>;
  contracts: Record<Role, Contract>;
  contractAddress: AztecAddress;
  // True when the worker is the user's own wallet, opened on
  // this device. Then worker sends pay their fee through the
  // test network sponsor (workerFee), because a fresh wallet
  // holds no fee money yet. Test workers are pre funded and
  // pay their own way, so workerFee stays null for them.
  workerIsUser: boolean;
  workerFee: FeePaymentMethod | null;
}

// Turns stored key strings back into chain key objects. Bad
// strings fail here, before any network work, with plain words.
function parseUserKeys(material: KeyMaterial): {
  secret: Fr;
  salt: Fr;
  signingKey: Fq;
} {
  try {
    return {
      secret: Fr.fromString(material.secret),
      salt: Fr.fromString(material.salt),
      signingKey: Fq.fromString(material.signingKey),
    };
  } catch {
    throw new Error(
      "Your wallet keys could not be read. Restore from your backup code.",
    );
  }
}

// Sign in is test accounts only, on the local network, with fake
// money. Each role gets its own wallet and private note store,
// following the official two wallet guide: before a wallet can
// see notes from a sender, it must register that sender, and
// before it can call a contract, it must register the contract.
//
// When userMaterial is given, the worker is the user's own
// wallet instead of the test worker. Client and other stay
// test accounts until they get their own wallet slice. The
// user's key material is used only inside this call and inside
// the session wallet it creates; it is never logged or stored.
export async function createChainSession(
  nodeUrl = AZTEC_NODE_URL,
  userMaterial?: KeyMaterial,
): Promise<ChainSession> {
  const userKeys = userMaterial ? parseUserKeys(userMaterial) : null;

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
    const account =
      role === "worker" && userKeys
        ? await wallet.createSchnorrInitializerlessAccount(
            userKeys.secret,
            userKeys.salt,
            userKeys.signingKey,
          )
        : await wallet.createSchnorrInitializerlessAccount(
            data[i].secret,
            data[i].salt,
            data[i].signingKey,
          );
    wallets[role] = wallet;
    accounts[role] = account.address;
  }

  const workerFee = userKeys ? await sponsoredFeeFor(wallets.worker) : null;
  const workerSendFee = workerFee
    ? { fee: { paymentMethod: workerFee } }
    : {};

  // Two ways to reach the contract, picked by settings only:
  // a pinned address (public network, contract already deployed)
  // or a fresh deploy (local network).
  let contractAddress: AztecAddress;
  let deployedHere = false;
  if (AZTEC_CONTRACT_ADDRESS !== "") {
    contractAddress = AztecAddress.schema.parse(AZTEC_CONTRACT_ADDRESS);
  } else {
    const { contract } = await Contract.deploy(wallets.worker, artifact, [])
      .send({ from: accounts.worker, ...workerSendFee });
    contractAddress = contract.address;
    deployedHere = true;
  }

  const instance = await node.getContract(contractAddress);
  if (!instance) {
    throw new Error("The contract cannot be seen on this network.");
  }
  for (const role of ROLES) {
    if (!(deployedHere && role === "worker")) {
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
    contracts[role] = await Contract.at(contractAddress, artifact, wallets[role]);
  }

  return {
    nodeUrl,
    wallets,
    accounts,
    contracts,
    contractAddress,
    workerIsUser: userKeys !== null,
    workerFee,
  };
}
