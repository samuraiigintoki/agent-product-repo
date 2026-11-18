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

export interface StoredClaim {
  id: string;
  claim: SinglePaymentClaim;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sixMonthsFrom(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString().slice(0, 10);
}

export function createStore() {
  const invoices: Invoice[] = [];
  const claims: StoredClaim[] = [];
  let nextClaim = 0;

  return {
    invoices,
    claims,
    addInvoice(input: CreateInvoiceInput): Invoice {
      const invoice = createInvoice(input);
      invoices.push(invoice);
      return invoice;
    },
    getInvoice(id: string): Invoice | undefined {
      return invoices.find((invoice) => invoice.id === id);
    },
    payInvoice(id: string, paidOn: string = today()): Invoice | undefined {
      const index = invoices.findIndex((invoice) => invoice.id === id);
      if (index === -1) {
        return undefined;
      }
      const paid = markPaid(invoices[index], invoices[index].amount, paidOn);
      invoices[index] = paid;
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
