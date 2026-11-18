# agent-product-repo

Home for the product we are building together. Working name:
Private Pay Proof. The real name comes after the first working
version proves itself.

Work is done on branches, checked, then put live through Vercel.
Main holds the live code only.

## What this is

A worker makes a bill link. A client pays in private on Aztec.
The worker keeps a private pay record and can prove one single
bill was paid in full, without showing their other pay or who
paid. The amount on the proof is hidden unless the worker
chooses to show it.

Fake money only. Test networks only. No real funds at any point
in this version.

## How to run the web app

```bash
cd apps/web
npm install
npm run dev
```

Open the page, make an invoice, open the pay link, pay, make a
proof, open the check link. With no sign in, the app uses fake
data in the page so anyone can walk the path.

For the live local path, start the Aztec local network first
(see TOOLCHAIN.md for the pinned tools), then use the test sign
in buttons on the home page. Chain code needs Node 24.

Run tests:

```bash
cd apps/web
npm test
```

Contract tests:

```bash
cd contracts/payment_proof
aztec test
```

## Where things stand

- Local network: the full path works. Worker makes an invoice,
  client pays in private, worker reads the receipt, a third
  account reads nothing.
- Public Aztec test network: the contract is deployed and the
  full path ran once by hand. Invoice at block 44150, pay at
  block 44155, proof mark at block 44156, receipt read back
  with the right amount. Each step took under about two
  minutes. The app still defaults to the local network, by the
  settings file in apps/web/src/chain/settings.ts.
- The checker page needs no wallet and no sign in.

## Honest limits

- The proof hash in this version is a tamper seal made on the
  worker device from the receipt. It is not yet a zero knowledge
  proof made from the private note itself. That is a later
  milestone and nothing here claims otherwise.
- The public book holds hashes and a paid flag. Do not reuse
  small bill marks in real life; the tests use 42 to stay
  readable.
- Wallets here are test accounts with known keys. Never send
  real money to them.
- Losing wallet access can mean losing private records. Backup
  and recovery must be designed before any real use.

## More docs

- Design: docs/superpowers/specs/2026-11-18-private-pay-proof-design.md
- Plan: docs/superpowers/plans/2026-11-18-single-payment-proof.md
- Toolchain spike: docs/spikes/aztec-toolchain.md
- Tester script: docs/testing/five-strangers-script.md
- Public packet: docs/build-in-public/packet-01-toolchain.md
