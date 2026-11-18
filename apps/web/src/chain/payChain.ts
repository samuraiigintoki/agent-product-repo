import { createAztecNodeClient } from "@aztec-labs/aztec.js/node";
import type { ChainSession } from "./wallet";

// Pays one bill from the client account to the worker, in private.
// Returns how many seconds the step took, so the page can show a
// calm waiting note with a real time, not a fake one.
export async function payInvoiceOnChain(
  session: ChainSession,
  input: { billId: number; amount: number; payerMark: number },
): Promise<{ seconds: number }> {
  const node = createAztecNodeClient(session.nodeUrl);
  const paidBlock = await node.getBlockNumber();
  const started = Date.now();
  await session.contracts.client.methods
    .pay_invoice(
      session.accounts.worker,
      input.billId,
      input.amount,
      input.payerMark,
      paidBlock,
    )
    .send({ from: session.accounts.client });
  return { seconds: Math.round((Date.now() - started) / 1000) };
}
