import { SponsoredFeePaymentMethod } from "@aztec-labs/aztec.js/fee";
import { getContractInstanceFromInstantiationParams } from "@aztec-labs/aztec.js/contracts";
import type { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import { Fr } from "@aztec-labs/foundation/curves/bn254";
import { SPONSORED_FPC_SALT } from "@aztec-labs/constants";
import { SponsoredFPCContract } from "@aztec-labs/noir-contracts.js/SponsoredFPC";
import type { EmbeddedWallet } from "@aztec-labs/wallets/embedded";

// First run fee sponsor. A fresh user wallet holds no fee
// money, so its first send fails until someone covers the fee
// (Task 1 spike). Test networks run a sponsor contract that
// pays fees for anyone; it lives at one fixed address on every
// test network, worked out here from the contract code and the
// shared salt, never typed in. On the local network and on the
// public test network this is the same address the network
// itself funds. When the network changes, settings change;
// this file does not.

async function sponsoredFpcInstance() {
  return getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: new Fr(SPONSORED_FPC_SALT) },
  );
}

export async function sponsoredFeeAddress(): Promise<string> {
  const instance = await sponsoredFpcInstance();
  return instance.address.toString();
}

// Registers the sponsor in the wallet (so it can build the fee
// payment) and returns the payment method to pass with a send.
export async function sponsoredFeeFor(
  wallet: EmbeddedWallet,
): Promise<SponsoredFeePaymentMethod> {
  const instance = await sponsoredFpcInstance();
  await wallet.registerContract(instance, SponsoredFPCContract.artifact);
  return new SponsoredFeePaymentMethod(instance.address as AztecAddress);
}
