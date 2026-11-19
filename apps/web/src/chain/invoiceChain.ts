import type { ActorSession } from "./wallet";

export interface ReceiptView {
  count: number;
  billId: number;
  amount: number;
  payerMark: number;
  paidBlock: number;
}

export async function createInvoiceOnChain(
  actor: ActorSession,
  input: { billId: number; amount: number; dueMark: number },
): Promise<void> {
  await actor.contract.methods
    .create_invoice(input.billId, input.amount, input.dueMark)
    .send({
      from: actor.account,
      ...(actor.fee ? { fee: { paymentMethod: actor.fee } } : {}),
    });
}

export async function readInvoiceCountOnChain(
  actor: ActorSession,
): Promise<number> {
  const { result } = await actor.contract.methods
    .invoices_count(actor.account)
    .simulate({ from: actor.account });
  if (typeof result === "bigint") {
    return Number(result);
  }
  if (typeof result === "number") {
    return result;
  }
  return Number((result as { toString(): string }).toString());
}

export async function readReceiptsOnChain(
  actor: ActorSession,
): Promise<ReceiptView> {
  const { result } = await actor.contract.methods
    .read_receipts(actor.account)
    .simulate({ from: actor.account });
  const fields = result as unknown[];
  const toNumber = (value: unknown): number => {
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "number") {
      return value;
    }
    return Number(value as { toString(): string });
  };
  return {
    count: toNumber(fields[0]),
    billId: toNumber(fields[1]),
    amount: toNumber(fields[2]),
    payerMark: toNumber(fields[3]),
    paidBlock: toNumber(fields[4]),
  };
}
