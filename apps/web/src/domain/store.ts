import {
  createInvoice,
  markPaid,
  MAX_CLIENT_MARK_LENGTH,
  MAX_WORK_TITLE_LENGTH,
  type CreateInvoiceInput,
  type Invoice,
} from "./invoice";
import {
  createSinglePaymentClaim,
  type SinglePaymentClaim,
} from "./claim";
import {
  invoiceFromPayLink,
  isWorkerAddress,
  type PayLinkData,
} from "./payLink";

export interface StoredClaim {
  id: string;
  claim: SinglePaymentClaim;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sixMonthsFrom(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  // Clamp to the last day of the target month, so Aug 31 plus
  // six months lands on Feb 28, not Mar 3.
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

// Bills save on this device so a refresh does not lose them.
// The storage holds bills only: title, amount, client mark,
// paid state. Never keys, never backup codes, never passwords.
// (Keys have their own sealed box in chain/keyVault.ts.)
export const BILLS_STORAGE_KEY = "private-pay-proof.bills.v1";

export interface BillStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultBillStorage(): BillStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStoredInvoice(value: unknown): value is Invoice {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const bill = value as Partial<Invoice>;
  const chainIdOk = (id: unknown) =>
    id === undefined ||
    (typeof id === "number" && Number.isSafeInteger(id) && id > 0);
  return (
    typeof bill.id === "string" &&
    bill.id !== "" &&
    typeof bill.workTitle === "string" &&
    bill.workTitle.trim() !== "" &&
    bill.workTitle.trim().length <= MAX_WORK_TITLE_LENGTH &&
    typeof bill.amount === "number" &&
    Number.isSafeInteger(bill.amount) &&
    bill.amount > 0 &&
    typeof bill.clientMark === "string" &&
    bill.clientMark.trim().length <= MAX_CLIENT_MARK_LENGTH &&
    (bill.state === "paid" || bill.state === "unpaid") &&
    (bill.paidAmount === null ||
      (typeof bill.paidAmount === "number" &&
        Number.isSafeInteger(bill.paidAmount) &&
        bill.paidAmount > 0)) &&
    (bill.paidOn === null ||
      (typeof bill.paidOn === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(bill.paidOn) &&
        !Number.isNaN(Date.parse(bill.paidOn)))) &&
    (bill.side === undefined || bill.side === "made" || bill.side === "sent") &&
    chainIdOk(bill.chainBillId) &&
    chainIdOk(bill.chainAttemptBillId) &&
    (bill.chainWorkerAddress === undefined ||
      (isWorkerAddress(bill.chainWorkerAddress) &&
        (bill.chainBillId !== undefined ||
          bill.chainAttemptBillId !== undefined)))
  );
}

// Reads stored bills one by one. One damaged record no
// longer wipes the sound ones, and a repeated bill id keeps
// only its first sound record.
function parseStoredBills(text: string | null): Invoice[] {
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen = new Set<string>();
    const bills: Invoice[] = [];
    for (const item of parsed) {
      if (!isStoredInvoice(item) || seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      bills.push({ ...item, side: item.side ?? "made" });
    }
    return bills;
  } catch {
    return [];
  }
}

function loadBills(storage: BillStorage | null): Invoice[] {
  if (!storage) {
    return [];
  }
  try {
    return parseStoredBills(storage.getItem(BILLS_STORAGE_KEY));
  } catch {
    return [];
  }
}

// Merges two copies of one bill. Paid wins over unpaid, so
// a stale tab can never unpay a bill. Network fields only
// fill empty slots, so a merge never moves a pay target.
function mergeBill(local: Invoice, stored: Invoice): Invoice {
  const paid = local.state === "paid" ? local : stored;
  return {
    ...stored,
    ...local,
    side: local.side === "made" || stored.side === "made" ? "made" : "sent",
    clientMark: local.clientMark || stored.clientMark,
    chainWorkerAddress: local.chainWorkerAddress ?? stored.chainWorkerAddress,
    chainBillId: local.chainBillId ?? stored.chainBillId,
    chainAttemptBillId: local.chainAttemptBillId ?? stored.chainAttemptBillId,
    state: paid.state,
    paidAmount: paid.paidAmount,
    paidOn: paid.paidOn,
  };
}

function mergeBillLists(local: Invoice[], stored: Invoice[]): Invoice[] {
  const merged = local.map((bill) => {
    const other = stored.find((item) => item.id === bill.id);
    return other ? mergeBill(bill, other) : bill;
  });
  for (const bill of stored) {
    if (!merged.some((item) => item.id === bill.id)) {
      merged.push(bill);
    }
  }
  return merged;
}

export function createStore(storage: BillStorage | null = defaultBillStorage()) {
  const invoices: Invoice[] = loadBills(storage);
  const claims: StoredClaim[] = [];
  let nextClaim = 0;
  let saveFailed = false;

  function replaceInvoices(next: Invoice[]): void {
    invoices.splice(0, invoices.length, ...next);
  }

  function saveBills(): void {
    if (!storage) {
      return;
    }
    // Read before writing. Another tab may have saved bills
    // this tab has never seen, and saving this tab's whole
    // list over them would lose those bills.
    try {
      const stored = parseStoredBills(storage.getItem(BILLS_STORAGE_KEY));
      replaceInvoices(mergeBillLists(invoices, stored));
    } catch {
      saveFailed = true;
      return;
    }
    try {
      storage.setItem(BILLS_STORAGE_KEY, JSON.stringify(invoices));
      saveFailed = false;
    } catch {
      // A full or blocked storage must not break making bills.
      // The bill still lives in this page; it just will not
      // survive a refresh. The flag lets a page say so.
      saveFailed = true;
    }
  }

  return {
    invoices,
    claims,
    get saveFailed() {
      return saveFailed;
    },
    syncFromStorage(): boolean {
      if (!storage) {
        return false;
      }
      try {
        const stored = parseStoredBills(storage.getItem(BILLS_STORAGE_KEY));
        const before = JSON.stringify(invoices);
        replaceInvoices(mergeBillLists(invoices, stored));
        return JSON.stringify(invoices) !== before;
      } catch {
        saveFailed = true;
        return false;
      }
    },
    addInvoice(input: CreateInvoiceInput): Invoice {
      const invoice = createInvoice(input);
      invoices.push(invoice);
      saveBills();
      return invoice;
    },
    getInvoice(id: string): Invoice | undefined {
      return invoices.find((invoice) => invoice.id === id);
    },
    getPayLinkConflict(data: PayLinkData): string | null {
      const existing = invoices.find((invoice) => invoice.id === data.id);
      if (!existing) {
        return null;
      }
      if (
        existing.workTitle !== data.workTitle ||
        existing.amount !== data.amount ||
        (existing.chainWorkerAddress &&
          data.workerAddress &&
          existing.chainWorkerAddress !== data.workerAddress) ||
        (existing.chainBillId &&
          data.billId &&
          existing.chainBillId !== data.billId)
      ) {
        return "This link clashes with a bill already on this device. It was not paid. Ask the worker to send the link again.";
      }
      return null;
    },
    importInvoice(data: PayLinkData): Invoice {
      // A bill arriving through a pay link joins this store
      // once. Opening the same link again never makes a copy.
      // A matching bill that lacks network fields gains them;
      // clashing fields are for the page to stop on first,
      // through getPayLinkConflict above.
      const index = invoices.findIndex((invoice) => invoice.id === data.id);
      if (index !== -1) {
        const existing = invoices[index];
        const filled = {
          ...existing,
          chainWorkerAddress:
            existing.chainWorkerAddress ?? data.workerAddress ?? undefined,
          chainBillId: existing.chainBillId ?? data.billId ?? undefined,
        };
        invoices[index] = filled;
        saveBills();
        return filled;
      }
      const invoice = invoiceFromPayLink(data);
      invoices.push(invoice);
      saveBills();
      return invoice;
    },
    setInvoiceChainAttempt(
      id: string,
      target: { workerAddress: string; billId: number },
    ): Invoice | undefined {
      const index = invoices.findIndex((invoice) => invoice.id === id);
      if (
        index === -1 ||
        !isWorkerAddress(target.workerAddress) ||
        !Number.isSafeInteger(target.billId) ||
        target.billId <= 0
      ) {
        return undefined;
      }
      const marked = {
        ...invoices[index],
        chainWorkerAddress: target.workerAddress,
        chainAttemptBillId: target.billId,
      };
      invoices[index] = marked;
      saveBills();
      return marked;
    },
    markInvoiceOnChain(
      id: string,
      target: { workerAddress: string; billId: number },
    ): Invoice | undefined {
      const index = invoices.findIndex((invoice) => invoice.id === id);
      if (
        index === -1 ||
        !isWorkerAddress(target.workerAddress) ||
        !Number.isSafeInteger(target.billId) ||
        target.billId <= 0
      ) {
        return undefined;
      }
      const marked = {
        ...invoices[index],
        chainWorkerAddress: target.workerAddress,
        chainBillId: target.billId,
        chainAttemptBillId: undefined,
      };
      invoices[index] = marked;
      saveBills();
      return marked;
    },
    payInvoice(id: string, paidOn: string = today()): Invoice | undefined {
      const index = invoices.findIndex((invoice) => invoice.id === id);
      if (index === -1) {
        return undefined;
      }
      if (invoices[index].state === "paid") {
        // One pay per bill. A second pay changes nothing, and
        // the first paid date stays locked.
        return invoices[index];
      }
      const paid = markPaid(invoices[index], invoices[index].amount, paidOn);
      invoices[index] = paid;
      saveBills();
      return paid;
    },
    markInvoicePaidOnNetwork(
      id: string,
      amount: number,
    ): Invoice | undefined {
      const index = invoices.findIndex((invoice) => invoice.id === id);
      if (index === -1 || invoices[index].amount !== amount) {
        return undefined;
      }
      if (invoices[index].state === "paid") {
        return invoices[index];
      }
      // No pay date is guessed here. A network read proves
      // the bill was paid, but this device may never learn
      // the day it happened.
      const paid: Invoice = {
        ...invoices[index],
        state: "paid",
        paidAmount: amount,
      };
      invoices[index] = paid;
      saveBills();
      return paid;
    },
    addClaim(invoiceId: string, showAmount: boolean): StoredClaim | undefined {
      const invoice = invoices.find((item) => item.id === invoiceId);
      if (!invoice) {
        return undefined;
      }
      const claim = createSinglePaymentClaim(
        invoice,
        showAmount,
        sixMonthsFrom(today()),
      );
      nextClaim += 1;
      const stored = { id: `claim-${nextClaim}`, claim };
      claims.push(stored);
      return stored;
    },
    getClaim(id: string): StoredClaim | undefined {
      return claims.find((stored) => stored.id === id);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
