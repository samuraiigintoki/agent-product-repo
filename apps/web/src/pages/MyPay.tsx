import type { Store } from "../domain/store";

export default function MyPay({ store }: { store: Store }) {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>My pay</h1>
      {store.invoices.length === 0 && (
        <p style={{ fontSize: 18 }}>No bills yet. Make your first invoice from the home page.</p>
      )}
      <div style={{ display: "grid", gap: 16 }}>
        {store.invoices.map((invoice) => (
          <div key={invoice.id} style={{ border: "1px solid #999", padding: 12 }}>
            <p style={{ fontSize: 20, margin: "4px 0" }}>{invoice.workTitle}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>Amount: {invoice.amount}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>Client: {invoice.clientMark}</p>
            <p style={{ fontSize: 18, margin: "4px 0" }}>
              {invoice.state === "paid"
                ? `Paid in full on ${invoice.paidOn}.`
                : "Not paid yet."}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
