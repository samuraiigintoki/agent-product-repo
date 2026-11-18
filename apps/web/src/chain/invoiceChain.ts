import type { ChainSession, Role } from "./wallet";

export interface ReceiptView {
  count: number;
  billId: number;
  amount: number;
  payerMark: number;
  paidBlock: number;
}

export async function createInvoiceOnChain(
  session: ChainSession,
  input: { billId: number; amount: number; dueMark: number },
): Promise<void> {
  await session.contracts.worker.methods
    .create_invoice(input.billId, input.amount, input.dueMark)
    .send({
      from: session.accounts.worker,
      ...(session.workerFee
        ? { fee: { paymentMethod: session.workerFee } }
        : {}),
    });
}

export async function readReceiptsOnChain(
  session: ChainSession,
  role: Role,
): Promise<ReceiptView> {
  const { result } = await session.contracts[role].methods
    .read_receipts(session.accounts[role])
    .simulate({ from: session.accounts[role] });
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
