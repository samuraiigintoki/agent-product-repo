import {
  createInvoice,
  markPaid,
  type CreateInvoiceInput,
  type Invoice,
} from "./invoice";
import {
  createSinglePaymentClaim,
  type SinglePaymentClaim,
} from "./claim";
import { invoiceFromPayLink, type PayLinkData } from "./payLink";

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
  return (
    typeof bill.id === "string" &&
    bill.id !== "" &&
    typeof bill.workTitle === "string" &&
    typeof bill.amount === "number" &&
    Number.isInteger(bill.amount) &&
    bill.amount > 0 &&
    typeof bill.clientMark === "string" &&
    (bill.state === "paid" || bill.state === "unpaid") &&
    (bill.paidAmount === null || typeof bill.paidAmount === "number") &&
    (bill.paidOn === null || typeof bill.paidOn === "string")
  );
}

function loadBills(storage: BillStorage | null): Invoice[] {
  if (!storage) {
    return [];
  }
  try {
    const text = storage.getItem(BILLS_STORAGE_KEY);
    if (!text) {
      return [];
    }
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isStoredInvoice)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function createStore(storage: BillStorage | null = defaultBillStorage()) {
  const invoices: Invoice[] = loadBills(storage);
  const claims: StoredClaim[] = [];
  let nextClaim = 0;

  function saveBills(): void {
    if (!storage) {
      return;
    }
    try {
      storage.setItem(BILLS_STORAGE_KEY, JSON.stringify(invoices));
    } catch {
      // A full or blocked storage must not break making bills.
      // The bill still lives in this page; it just will not
      // survive a refresh.
    }
  }

  return {
    invoices,
    claims,
    addInvoice(input: CreateInvoiceInput): Invoice {
      const invoice = createInvoice(input);
      invoices.push(invoice);
      saveBills();
      return invoice;
    },
    getInvoice(id: string): Invoice | undefined {
      return invoices.find((invoice) => invoice.id === id);
    },
    importInvoice(data: PayLinkData): Invoice {
      // A bill arriving through a pay link joins this store
      // once. Opening the same link again never makes a copy.
      const existing = invoices.find((invoice) => invoice.id === data.id);
      if (existing) {
        return existing;
      }
      const invoice = invoiceFromPayLink(data);
      invoices.push(invoice);
      saveBills();
      return invoice;
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
