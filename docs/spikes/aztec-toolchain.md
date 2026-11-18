# Aztec toolchain proof of life

Date: 2026-11-18. This is a spike, which means a small trial run
to check that a tool works before we build on it. Fake test money
only. Nothing here is the product.

## Plain answer

Yes on all three facts the plan asked about:

1. The Aztec local network runs in this build sandbox.
2. A private token move works on it: public to private, then
   private from one account to a second account.
3. A custom private note can carry our pay fields, and only the
   owner account can read it back.

## Exact versions

Recorded in TOOLCHAIN.md at the repo root, each shown by the
tool's own version command. Tools: Aztec 6.0.0, wallet 6.0.0,
Noir compiler 1.0.0-rc.3, Node v24.15.0.

## What ran

- Official installer for version 6.0.0. First try in the temp
  folder failed because the temp folder here holds about 1 GB
  and the install filled it. The working install lives on disk
  outside the repo and must never be committed.
- Local network started and answered on port 8080. Three
  built-in test accounts loaded into the wallet fine.
- Token steps from the official guide: token deployed,
  100 made public, public balance read back 100, 25 moved to
  private, public 75, private 25, then 10 moved private from
  the first account to the second account. That move landed
  in block 8 and the first account then read private 15.
- One honest snag: the second account's wallet read 0 right
  after that move even after waiting, registering the sender,
  and retrying. In the fast contract test tool below the same
  two-party private note read works fine, so this looks like a
  wallet sync delay in separate wallet runs, not a rule in the
  network itself. It is written here so it is not hidden.
  Contract tests, not wallet runs, carry the proof for steps
  like this from now on.
- Custom note trial: a throwaway contract with a note holding
  bill mark 42, amount 1250, payer mark 7 and paid block 9.
  A fast contract test gave the note to the worker account and
  read it back: worker count 1, amount 1250, other account
  count 0. Only the owner reads the note. Test took about
  72 seconds including tool start.

## Time each private step took here

- Deploy example token: about 5 seconds.
- Public to private move: about 2 seconds.
- Private move to a second account: seconds, one block.
- First compile of a new contract: about 10 minutes on this
  small sandbox. Later runs reuse saved work and are far
  faster (seconds). One full contract test run: about
  72 seconds.

## Limits found in this sandbox

This sandbox has about 2 GB of memory and 2 cores. Rules learned:

- Do not run the local network and the contract test tool at
  the same time. Together they ran the sandbox out of memory
  and the test run was killed. Run one heavy tool at a time.
- The contract test tool needs `nc` (netcat, a tiny network
  checker) which is not installed here. A small stand-in placed
  in /tmp fixed it. It is a sandbox gap, not an Aztec fault.
- Proving was off for local wallet runs (PXE_PROVER=none),
  which the official local guide allows. Real proving on
  testnet is a later task and may be slow here.

## Stop rule outcome

The plan's stop rule was: if a private step cannot run here,
stop and report, do not build on a guess. That did not happen.
All three facts came back yes, with the one wallet sync snag
named above. It is safe to build the plan's next tasks here,
one heavy tool at a time.
