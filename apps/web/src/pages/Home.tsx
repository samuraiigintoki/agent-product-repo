import { useState } from "react";
import { signInTestAccount } from "../chain/session";
import type { Role } from "../chain/wallet";

export default function Home() {
  const [liveNote, setLiveNote] = useState<string | null>(null);

  const signIn = async (role: Role, label: string) => {
    setLiveNote("Signing in. This can take a few seconds.");
    try {
      await signInTestAccount(role);
      setLiveNote(`Signed in as the ${label} test account. Fake money only.`);
    } catch {
      setLiveNote(
        "Could not reach the local network. It must be running on this computer first.",
      );
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32 }}>Get paid in private. Prove it when you need to.</h1>
      <p style={{ fontSize: 18 }}>
        Send a bill link. Your client pays in private. Later you can prove
        one bill was paid, without showing your whole pay history.
      </p>
      <p>Fake test money only. Nothing here is real money.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <button
          style={{ fontSize: 20, padding: 16 }}
          onClick={() => {
            window.location.hash = "#/invoice";
          }}
        >
          New invoice
        </button>
        <button
          style={{ fontSize: 20, padding: 16 }}
          onClick={() => {
            window.location.hash = "#/mypay";
          }}
        >
          My pay
        </button>
        <button
          style={{ fontSize: 20, padding: 16 }}
          onClick={() => {
            window.location.hash = "#/proof";
          }}
        >
          Make proof
        </button>
      </div>
      <div style={{ marginTop: 32, border: "1px solid #999", padding: 16 }}>
        <p style={{ fontSize: 20, margin: "4px 0" }}>Live local network (test)</p>
        <p>
          Sign in with a test account to write bills and pay on the local
          Aztec network. Fake money only. When no one is signed in, the
          buttons above use fake data on this page only.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <button style={{ fontSize: 18, padding: 12 }} onClick={() => signIn("worker", "worker")}>
            Sign in as worker (test)
          </button>
          <button style={{ fontSize: 18, padding: 12 }} onClick={() => signIn("client", "client")}>
            Sign in as client (test)
          </button>
          <button style={{ fontSize: 18, padding: 12 }} onClick={() => signIn("other", "third")}>
            Sign in as third account (test)
          </button>
        </div>
        {liveNote !== null && <p style={{ fontSize: 18 }}>{liveNote}</p>}
      </div>
    </main>
  );
}
