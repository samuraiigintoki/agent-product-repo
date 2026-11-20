import { createAztecNodeClient } from "@aztec-labs/aztec.js/node";
import type { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import type { ActorSession } from "./wallet";

// Pays one bill from the acting account to a named worker, in
// private. The worker is an input, not read from the session,
// so a client on another device can pay a worker they have
// never shared a session with. Returns how many seconds the
// step took, so the page can show a calm waiting note with a
// real time, not a fake one.
export async function payInvoiceOnChain(
  actor: ActorSession,
  input: {
    worker: AztecAddress;
    billId: number;
    amount: number;
    payerMark: number;
  },
): Promise<{ seconds: number }> {
  const node = createAztecNodeClient(actor.nodeUrl);
  const paidBlock = await node.getBlockNumber();
  const started = Date.now();
  await actor.contract.methods
    .pay_invoice(
      input.worker,
      input.billId,
      input.amount,
      input.payerMark,
      paidBlock,
    )
    .send({
      from: actor.account,
      ...(actor.fee ? { fee: { paymentMethod: actor.fee } } : {}),
    });
  return { seconds: Math.round((Date.now() - started) / 1000) };
}
