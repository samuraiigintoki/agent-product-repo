import type { Invoice } from "./invoice";

// A pay link carries its own bill, so the link opens on any
// phone, in a new tab, or after a refresh. Version 1 links
// carry id, title, and amount. Version 2 links also carry the
// worker wallet address and the bill number on chain, which
// is everything a client wallet on another device needs to
// pay for real. The client mark stays out of the link on
// purpose: anyone holding the link does not need it. Only the
// named fields below ever ride in a link; nothing else in the
// text is read back out. Like the proof links, the segment
// starts with "p." so old and new links live side by side.

export interface PayLinkData {
  id: string;
  workTitle: string;
  amount: number;
  // Null on version 1 links, which predate real client
  // wallets. A version 1 link still opens and shows the bill;
  // paying on chain needs a version 2 link.
  workerAddress: string | null;
  billId: number | null;
}

const WORKER_ADDRESS_SHAPE = /^0x[0-9a-fA-F]{64}$/;

export function isWorkerAddress(value: unknown): value is string {
  return typeof value === "string" && WORKER_ADDRESS_SHAPE.test(value);
}

export function encodePayLink(
  invoice: Invoice,
  chain?: { workerAddress: string; billId: number },
): string {
  const data = chain
    ? {
        v: 2,
        id: invoice.id,
        workTitle: invoice.workTitle,
        amount: invoice.amount,
        worker: chain.workerAddress,
        billId: chain.billId,
      }
    : {
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
    ) as Partial<{
      v: number;
      id: string;
      workTitle: string;
      amount: number;
      worker: string;
      billId: number;
    }>;
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
    const base = {
      id: parsed.id,
      workTitle: parsed.workTitle,
      amount: parsed.amount,
    };
    if (parsed.v === undefined) {
      return { ...base, workerAddress: null, billId: null };
    }
    // A link that claims version 2 but lacks sound pay targets
    // is broken, never quietly read as an old link.
    if (
      parsed.v !== 2 ||
      !isWorkerAddress(parsed.worker) ||
      typeof parsed.billId !== "number" ||
      !Number.isInteger(parsed.billId) ||
      parsed.billId <= 0
    ) {
      return null;
    }
    return { ...base, workerAddress: parsed.worker, billId: parsed.billId };
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
    side: "sent",
    ...(data.workerAddress && data.billId
      ? {
          chainWorkerAddress: data.workerAddress,
          chainBillId: data.billId,
        }
      : {}),
  };
}
