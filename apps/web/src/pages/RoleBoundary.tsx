import { useState } from "react";
import {
  dropChainSession,
  signInWithUserWallet,
} from "../chain/session";

// Shown instead of a page body when the wallet is connected
// in the other role. One wallet holds one role at a time:
// the worker pages and the pay page never draw each other's
// main action. Switching drops the network session and
// connects in the needed role. The wallet itself stays
// open; only the network role changes.
export default function RoleBoundary({
  needed,
}: {
  needed: "worker" | "client";
}) {
  const [note, setNote] = useState<string | null>(null);
  const workerNeeded = needed === "worker";

  const switchRole = async () => {
    try {
      await dropChainSession();
      await signInWithUserWallet(needed);
      window.location.hash = "#/";
    } catch (error) {
      setNote(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28 }}>
        {workerNeeded
          ? "This wallet is connected to pay bills"
          : "This wallet is connected to make bills"}
      </h1>
      <p style={{ fontSize: 18 }}>
        {workerNeeded
          ? "These pages are for making bills. To use them, switch this wallet to making bills. Your wallet stays open. Only the network role changes."
          : "This page is for paying a bill. To use it, switch this wallet to paying bills. Your wallet stays open. Only the network role changes."}
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <button
          style={{ fontSize: 20, padding: 14 }}
          onClick={() => void switchRole()}
        >
          {workerNeeded ? "Switch to making bills" : "Switch to paying bills"}
        </button>
        <button
          style={{ fontSize: 20, padding: 14 }}
          onClick={() => {
            window.location.hash = "#/";
          }}
        >
          Go home
        </button>
      </div>
      {note !== null && <p style={{ fontSize: 18 }}>{note}</p>}
    </main>
  );
}
