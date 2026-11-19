export type InvoiceState = "unpaid" | "paid";

export type InvoiceSide = "made" | "sent";

export interface Invoice {
  id: string;
  workTitle: string;
  amount: number;
  clientMark: string;
  state: InvoiceState;
  paidAmount: number | null;
  paidOn: string | null;
  // Which side of the flow this bill belongs to on this
  // device. Old stored bills have no mark and are read as
  // made, because that was the only saved kind when they
  // were written.
  side?: InvoiceSide;
  // Set only after the bill is written on the network. These
  // two values are the public pay target for the final link.
  // They are not keys and they do not unlock anything.
  chainWorkerAddress?: string;
  chainBillId?: number;
  // The chain bill number reserved before a network write.
  // It lets a failed or cut off write retry the same bill.
  // It is not a final target until chainBillId is set.
  chainAttemptBillId?: number;
}

export const MAX_WORK_TITLE_LENGTH = 120;
export const MAX_CLIENT_MARK_LENGTH = 80;

export interface CreateInvoiceInput {
  workTitle: string;
  amount: number;
  clientMark: string;
}

let nextId = 0;

export interface InvoiceInputIssue {
  field: "workTitle" | "amount" | "clientMark";
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
  clientMark?: string;
}): InvoiceInputIssue | null {
  if (input.workTitle.trim() === "") {
    return { field: "workTitle", message: "Give the work a title." };
  }
  if (input.workTitle.trim().length > MAX_WORK_TITLE_LENGTH) {
    return {
      field: "workTitle",
      message: `Work title must be ${MAX_WORK_TITLE_LENGTH} characters or less.`,
    };
  }
  if (
    !Number.isFinite(input.amount) ||
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0
  ) {
    return {
      field: "amount",
      message: "Amount must be a whole number above zero, like 1250.",
    };
  }
  if ((input.clientMark ?? "").trim().length > MAX_CLIENT_MARK_LENGTH) {
    return {
      field: "clientMark",
      message: `Client name or mark must be ${MAX_CLIENT_MARK_LENGTH} characters or less.`,
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
    side: "made",
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
