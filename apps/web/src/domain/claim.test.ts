import { describe, expect, it } from "vitest";
import { createSinglePaymentClaim, checkClaim } from "./claim";
import { createInvoice, markPaid } from "./invoice";

function paidInvoice() {
  const invoice = createInvoice({
    workTitle: "Logo design",
    amount: 1250,
    clientMark: "Client A",
  });
  return markPaid(invoice, 1250, "2026-11-18");
}

describe("createSinglePaymentClaim", () => {
  it("hides the amount by default choice passed in, and says paid in full", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), false, "2027-05-18");
    expect(claim.amount).toBeNull();
    expect(claim.text).toContain("paid in full");
    expect(claim.text).toContain("2026-11-18");
    expect(claim.expiresAt).toBe("2027-05-18");
  });

  it("shows the amount only when the worker chooses to show it", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), true, "2027-05-18");
    expect(claim.amount).toBe(1250);
  });

  it("refuses to make a claim for an unpaid invoice", () => {
    const invoice = createInvoice({
      workTitle: "Logo design",
      amount: 1250,
      clientMark: "Client A",
    });
    expect(() => createSinglePaymentClaim(invoice, false, "2027-05-18")).toThrow(
      "not paid",
    );
  });
});

describe("checkClaim", () => {
  it("says valid before the expiry date", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), false, "2027-05-18");
    expect(checkClaim(claim, "2026-12-01")).toBe("valid");
  });

  it("says expired after the expiry date", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), false, "2027-05-18");
    expect(checkClaim(claim, "2027-06-01")).toBe("expired");
  });

  it("says broken when the shown amount was edited", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), true, "2027-05-18");
    const edited = { ...claim, amount: 900 };
    expect(checkClaim(edited, "2026-12-01")).toBe("broken");
  });

  it("says broken when the claim text was edited", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), false, "2027-05-18");
    const edited = { ...claim, text: "This bill was paid in full on 2020-01-01." };
    expect(checkClaim(edited, "2026-12-01")).toBe("broken");
  });

  it("says broken when the expiry date was edited", () => {
    const claim = createSinglePaymentClaim(paidInvoice(), false, "2027-05-18");
    const edited = { ...claim, expiresAt: "2030-01-01" };
    expect(checkClaim(edited, "2026-12-01")).toBe("broken");
  });
});
