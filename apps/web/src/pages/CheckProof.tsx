import { checkClaim } from "../domain/claim";
import { today, type Store } from "../domain/store";

export default function CheckProof({ store, id }: { store: Store; id: string }) {
  const stored = store.getClaim(id);

  if (!stored) {
    return (
      <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28 }}>This proof link does not work.</h1>
        <p style={{ fontSize: 18 }}>Ask the worker to send the link again.</p>
      </main>
    );
  }

  const result = checkClaim(stored.claim, today());
  const { claim } = stored;

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>Payment proof check</h1>
      {result === "valid" && (
        <p style={{ fontSize: 36, color: "green", fontWeight: "bold" }}>Valid</p>
      )}
      {result === "expired" && (
        <p style={{ fontSize: 36, color: "#b26a00", fontWeight: "bold" }}>This proof has run out.</p>
      )}
      {result === "broken" && (
        <p style={{ fontSize: 36, color: "red", fontWeight: "bold" }}>This proof is broken.</p>
      )}
      <p style={{ fontSize: 22 }}>{claim.text}</p>
      {claim.amount !== null && (
        <p style={{ fontSize: 20 }}>Amount: {claim.amount}</p>
      )}
      <p style={{ fontSize: 18 }}>This proof runs out on {claim.expiresAt}.</p>
      <p style={{ fontSize: 16 }}>
        This page only checks this one proof. It does not show any
        other pay, and no wallet is needed to read it.
      </p>
    </main>
  );
}
