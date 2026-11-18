// One place for network settings. No secrets live here.
// Switching networks is a settings change only: set
// VITE_AZTEC_NODE_URL (and VITE_AZTEC_CONTRACT_ADDRESS when the
// contract already lives on that network) at build time.
// No other file may type a network address or contract address.
const env = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env;

export const LOCAL_NODE_URL = "http://localhost:8080";

export const AZTEC_NODE_URL: string =
  env?.VITE_AZTEC_NODE_URL ?? LOCAL_NODE_URL;

// Empty means: no contract is pinned, so a fresh one is deployed
// on sign in. That is the local network flow. On a public
// network, set this to the deployed contract address instead.
export const AZTEC_CONTRACT_ADDRESS: string =
  env?.VITE_AZTEC_CONTRACT_ADDRESS ?? "";

export const NETWORK_LABEL = AZTEC_NODE_URL.includes("localhost")
  ? "local test network"
  : "public test network";
