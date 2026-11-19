import { createAztecNodeClient } from "@aztec-labs/aztec.js/node";
import type { AztecAddress } from "@aztec-labs/aztec.js/addresses";
import type { ChainSession } from "./wallet";

// Pays one bill from the client account to a named worker, in
// private. The worker is an input, not read from the session,
// so a client on another device can pay a worker they have
// never shared a session with. Returns how many seconds the
// step took, so the page can show a calm waiting note with a
// real time, not a fake one.
export async function payInvoiceOnChain(
  session: ChainSession,
  input: {
    worker: AztecAddress;
    billId: number;
    amount: number;
    payerMark: number;
  },
): Promise<{ seconds: number }> {
  const node = createAztecNodeClient(session.nodeUrl);
  const paidBlock = await node.getBlockNumber();
  const started = Date.now();
  await session.contracts.client.methods
    .pay_invoice(
      input.worker,
      input.billId,
      input.amount,
      input.payerMark,
      paidBlock,
    )
    .send({
      from: session.accounts.client,
      ...(session.clientFee
        ? { fee: { paymentMethod: session.clientFee } }
        : {}),
    });
  return { seconds: Math.round((Date.now() - started) / 1000) };
}
