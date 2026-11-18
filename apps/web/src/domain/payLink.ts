import type { Invoice } from "./invoice";

// A pay link carries its own bill: id, title, and amount ride
// inside the link, so the link opens on any phone, in a new
// tab, or after a refresh. The client mark stays out of the
// link on purpose: anyone holding the link does not need it.
// Like the proof links, the segment starts with "p." so old
// short links and new carrying links can live side by side.

export interface PayLinkData {
  id: string;
  workTitle: string;
  amount: number;
}

export function encodePayLink(invoice: Invoice): string {
  const data: PayLinkData = {
    id: invoice.id,
    workTitle: invoice.workTitle,
    amount: invoice.amount,
  };
  return `p.${btoa(encodeURIComponent(JSON.stringify(data)))}`;
}

export function decodePayLink(segment: string): PayLinkData | null {
  if (!segment.startsWith("p.")) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      decodeURIComponent(atob(segment.slice(2))),
    ) as Partial<PayLinkData>;
    if (
      typeof parsed.id !== "string" ||
      parsed.id === "" ||
      typeof parsed.workTitle !== "string" ||
      parsed.workTitle.trim() === "" ||
      typeof parsed.amount !== "number" ||
      !Number.isInteger(parsed.amount) ||
      parsed.amount <= 0
    ) {
      return null;
    }
    return {
      id: parsed.id,
      workTitle: parsed.workTitle,
      amount: parsed.amount,
    };
  } catch {
    return null;
  }
}

export function invoiceFromPayLink(data: PayLinkData): Invoice {
  return {
    id: data.id,
    workTitle: data.workTitle,
    amount: data.amount,
    clientMark: "",
    state: "unpaid",
    paidAmount: null,
    paidOn: null,
  };
}
