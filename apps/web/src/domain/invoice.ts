export type InvoiceState = "unpaid" | "paid";

export interface Invoice {
  id: string;
  workTitle: string;
  amount: number;
  clientMark: string;
  state: InvoiceState;
  paidAmount: number | null;
  paidOn: string | null;
}

export interface CreateInvoiceInput {
  workTitle: string;
  amount: number;
  clientMark: string;
}

let nextId = 0;

export function createInvoice(input: CreateInvoiceInput): Invoice {
  nextId += 1;
  return {
    id: `inv-${nextId}-${Date.now().toString(36)}`,
    workTitle: input.workTitle,
    amount: input.amount,
    clientMark: input.clientMark,
    state: "unpaid",
    paidAmount: null,
    paidOn: null,
  };
}

export function markPaid(
  invoice: Invoice,
  paidAmount: number,
  paidOn: string,
): Invoice {
  if (paidAmount !== invoice.amount) {
    return { ...invoice, state: "unpaid", paidAmount: null, paidOn: null };
  }
  return { ...invoice, state: "paid", paidAmount, paidOn };
}
