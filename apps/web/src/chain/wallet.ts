import { createAztecNodeClient, waitForNode } from "@aztec-labs/aztec.js/node";
import { EmbeddedWallet } from "@aztec-labs/wallets/embedded";
import { getInitialTestAccountsData } from "@aztec-labs/accounts/testing";
import { Contract } from "@aztec-labs/aztec.js/contracts";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec-labs/aztec.js/abi";
import { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fq, Fr } from "@aztec-labs/foundation/curves/bn254";
import type { FeePaymentMethod } from "@aztec-labs/aztec.js/fee";
import artifactJson from "./payment_proof_artifact.json";
import { AZTEC_CONTRACT_ADDRESS, AZTEC_NODE_URL, isLocalNodeUrl } from "./settings";
import { sponsoredFeeFor } from "./feeSponsor";
import type { KeyMaterial } from "./keyVault";
import { chainStoreOverrides, plainChainError } from "./browserStore";

const artifact = loadContractArtifact(artifactJson as unknown as NoirCompiledContract);

export type Role = "worker" | "client" | "other";
export const ROLES: Role[] = ["worker", "client", "other"];

export interface ChainSession {
  nodeUrl: string;
  wallets: Record<Role, EmbeddedWallet>;
  accounts: Record<Role, AztecAddress>;
  contracts: Record<Role, Contract>;
  contractAddress: AztecAddress;
  // The role the user's own wallet holds in this session, if
  // any: "worker" when they make bills, "client" when they
  // pay one. One session, one user role. Test accounts fill
  // the rest only in code tests, never in the app flow (see
  // the real flow plan, Task 5). Sends from the user role pay
  // their fee through the test network sponsor (workerFee or
  // clientFee), because a fresh wallet holds no fee money
  // yet. Test accounts are pre funded and pay their own way.
  userRole: Role | null;
  workerFee: FeePaymentMethod | null;
  clientFee: FeePaymentMethod | null;
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

// One actor on chain: a contract handle, the account acting,
// and how its fees are paid. Chain calls take this, so the
// same call works for the user's wallet in the app and for
// test account actors in plumbing checks.
export interface ActorSession {
  nodeUrl: string;
  contract: Contract;
  account: AztecAddress;
  fee: FeePaymentMethod | null;
}

// The app session: exactly ONE wallet, the user's own, in one
// role. A browser allows only one wallet store per site, so
// opening three wallet engines in one page (the old test
// account habit) breaks with a store already in use error.
// One wallet per page is both the browser rule and the real
// product shape.
export interface UserChainSession extends ActorSession {
  wallet: EmbeddedWallet;
  userRole: Role;
  contractAddress: AztecAddress;
}

export async function createUserChainSession(
  nodeUrl = AZTEC_NODE_URL,
  material: KeyMaterial,
  userRole: Role,
): Promise<UserChainSession> {
  const userKeys = parseUserKeys(material);

  let node: ReturnType<typeof createAztecNodeClient>;
  try {
    node = createAztecNodeClient(nodeUrl);
    await waitForNode(node);
  } catch {
    throw new Error("The network cannot be reached at this address.");
  }

  // In a browser that refuses the normal wallet storage,
  // this hands the engine a fallback store instead. It is
  // null everywhere else, including all Node test runs.
  const overrides = await chainStoreOverrides();
  let wallet: EmbeddedWallet;
  try {
    wallet = await EmbeddedWallet.create(node, {
      ephemeral: true,
      // Proving off only on a local network, where unproven
      // work is accepted. Public networks need real proofs.
      pxe: {
        proverEnabled: !isLocalNodeUrl(nodeUrl),
        ...(overrides ? { store: overrides.pxeStore } : {}),
      },
      ...(overrides ? { walletDb: { store: overrides.walletStore } } : {}),
    });
  } catch (error) {
    throw plainChainError(error);
  }
  try {
    const accountManager = await wallet.createSchnorrInitializerlessAccount(
      userKeys.secret,
      userKeys.salt,
      userKeys.signingKey,
    );
    const account = accountManager.address;
    const fee = await sponsoredFeeFor(wallet);

    let contractAddress: AztecAddress;
    let deployedHere = false;
    if (AZTEC_CONTRACT_ADDRESS !== "") {
      try {
        contractAddress = AztecAddress.schema.parse(AZTEC_CONTRACT_ADDRESS);
      } catch {
        throw new Error("The contract address setting is not valid.");
      }
    } else {
      const { contract } = await Contract.deploy(wallet, artifact, []).send({
        from: account,
        fee: { paymentMethod: fee },
      });
      contractAddress = contract.address;
      deployedHere = true;
    }

    const instance = await node.getContract(contractAddress);
    if (!instance) {
      throw new Error("The contract cannot be seen on this network.");
    }
    if (!deployedHere) {
      await wallet.registerContract(instance, artifact);
    }
    const contract = await Contract.at(contractAddress, artifact, wallet);

    return {
      nodeUrl,
      wallet,
      contract,
      account,
      fee,
      userRole,
      contractAddress,
    };
  } catch (error) {
    await wallet.stop().catch(() => {});
    throw error;
  }
}

// PLUMBING ONLY: actor view of one role inside a test account
// session, for code tests. The app never builds these; it
// uses createUserChainSession above.
export function actorFor(session: ChainSession, role: Role): ActorSession {
  return {
    nodeUrl: session.nodeUrl,
    contract: session.contracts[role],
    account: session.accounts[role],
    fee:
      role === "worker"
        ? session.workerFee
        : role === "client"
          ? session.clientFee
          : null,
  };
}

// Builds one chain session. Each role gets its own wallet and
// private note store, following the official two wallet guide:
// before a wallet can see notes from a sender, it must register
// that sender, and before it can call a contract, it must
// register the contract.
//
// In the app this is only ever called with userMaterial, so
// the role named by userRole is the user's own wallet. Called
// without userMaterial it builds shared test accounts, and
// that path exists for code tests only (plumbing checks). No
// app screen can reach it. The user's key material is used
// only inside this call and inside the session wallet it
// creates; it is never logged or stored.
export async function createChainSession(
  nodeUrl = AZTEC_NODE_URL,
  userMaterial?: KeyMaterial,
  userRole: Role = "worker",
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
      // Proving off only on a local network, where unproven
      // work is accepted. Public networks need real proofs.
      pxe: { proverEnabled: !isLocalNodeUrl(nodeUrl) },
    });
    const account =
      role === userRole && userKeys
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

  const userFee = userKeys ? await sponsoredFeeFor(wallets[userRole]) : null;
  const workerFee = userRole === "worker" ? userFee : null;
  const clientFee = userRole === "client" ? userFee : null;
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
    userRole: userKeys ? userRole : null,
    workerFee,
    clientFee,
  };
}
