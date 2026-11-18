// One place for network settings. No secrets live here.
// The local network is the default. A public test network
// address can be set with VITE_AZTEC_NODE_URL at build time.
export const AZTEC_NODE_URL: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_AZTEC_NODE_URL ?? "http://localhost:8080";

export const NETWORK_LABEL = AZTEC_NODE_URL.includes("localhost")
  ? "local test network"
  : "public test network";
