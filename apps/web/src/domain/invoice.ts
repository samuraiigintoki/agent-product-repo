export type InvoiceState = "unpaid" | "paid";

export interface Invoice {
  id: string;
  workTitle: string;
  amount: number;
  clientMark: string;
  state: InvoiceState;
  paidAmount: number | null;
  paidOn: string | null;
  // Set only after the bill is written on the network. These
  // two values are the public pay target for the final link.
  // They are not keys and they do not unlock anything.
  chainWorkerAddress?: string;
  chainBillId?: number;
}

export interface CreateInvoiceInput {
  workTitle: string;
  amount: number;
  clientMark: string;
}

let nextId = 0;

export interface InvoiceInputIssue {
  field: "workTitle" | "amount";
  message: string;
}

// People type amounts like "1,250" or " 1250 ". Turn that text
// into a plain number first. Letters stay letters and fail below.
export function parseAmountInput(text: string): number {
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "") {
    return 0;
  }
  return Number(cleaned);
}

// One home for the input rules. The form uses this to point at
// the wrong field, and createInvoice uses it as a hard guard so
// no caller can sneak a broken bill past the form.
export function validateInvoiceInput(input: {
  workTitle: string;
  amount: number;
}): InvoiceInputIssue | null {
  if (input.workTitle.trim() === "") {
    return { field: "workTitle", message: "Give the work a title." };
  }
  if (
    !Number.isFinite(input.amount) ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  ) {
    return {
      field: "amount",
      message: "Amount must be a whole number above zero, like 1250.",
    };
  }
  return null;
}

export function createInvoice(input: CreateInvoiceInput): Invoice {
  const issue = validateInvoiceInput(input);
  if (issue) {
    throw new Error(issue.message);
  }
  nextId += 1;
  return {
    id: `inv-${nextId}-${Date.now().toString(36)}`,
    workTitle: input.workTitle.trim(),
    amount: input.amount,
    clientMark: input.clientMark.trim(),
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
