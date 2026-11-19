import WalletPanel from "./WalletPanel";

export default function Home() {
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
      <p style={{ fontSize: 18, marginTop: 16 }}>
        Until your wallet is connected below, these buttons work with
        bills kept on this device only. Connect your wallet to write
        bills and pay on the network.
      </p>
      <WalletPanel />
    </main>
  );
}
