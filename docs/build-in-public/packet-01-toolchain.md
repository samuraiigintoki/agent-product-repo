# Public packet 01: the tools work, and one payment path runs

Status: draft for owner approval. Nothing here is posted until
the owner says yes.

## What changed

- Proved the Aztec tools run in our build space: local network,
  private token moves, and a custom private pay note that only
  its owner can read.
- Built the plain rules for invoices and proofs, the six screens,
  the payment contract, and wired the screens to the local
  network.
- Ran the full path once on the public Aztec test network.

## Why it matters

The product idea is a private pay link with a proof a worker can
show later. Before building more, we needed to know the base
tools can really do private pay and private records. They can.

## Proof (real results only)

- Contract tests: 7 of 7 pass. Bill made, exact pay gives the
  worker a receipt, wrong amount fails, second pay fails, a
  third account reads nothing, public record leaks nothing.
- Web tests: 22 of 22 pass, including a live local network test
  of invoice, private pay, and receipt read back in about
  16 seconds.
- Public test network: contract deployed, invoice at block
  44150, pay at block 44155, proof mark at block 44156, receipt
  read back with bill 42 and amount 1250. Each step took under
  about two minutes.
- Privacy scan of the built site: no keys, no passwords, no
  test worker address, no test job text. Public state in tests
  held only hashes and flags.

## Honest blocker

The proof hash in this first version is a tamper seal made on
the worker device from the private receipt. It is not yet a
zero knowledge proof made from the note itself. That is the
next hard step, and we will say so plainly when we get there.

Also honest: the build sandbox is small. Heavy tools must run
one at a time, and the first compile of a new contract took
about 10 minutes there.

## Next step

Five strangers try the full path with fake money, timed, using
docs/testing/five-strangers-script.md. At the end we ask if they
would pay for the proof with real money, and why. If most say
no, we stop and rethink before building more.

## Tester ask

Not yet. The ask goes out only when the owner approves this
packet and the trial link is shared.
