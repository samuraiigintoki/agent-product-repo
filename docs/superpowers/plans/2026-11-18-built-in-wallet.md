# Built in wallet: short plan (needs owner yes before code)

Goal: a real user gets their own keys, made on their own
device, locked with a password, with a backup they can restore
on a new device. Test accounts stay, clearly marked as test
only, for local checks.

Why this order: keys are the one part we cannot patch later
without pain. A lost key means lost records. So this slice is
small, tested hard, and reviewed twice before it ships.

## Task 1: proof of life spike (no UI)
- Make a fresh random account with the wallet code we already
  use, on the local network. No known test keys.
- Show: the account gets an address, can be registered again
  from the same secret on a second wallet (same address), and
  can run create_invoice. Time each step.
- If a fresh account cannot send until it is deployed on the
  network, write down what deploys it and what it costs in fake
  fee money. Stop and tell the owner if this blocks the design.

## Task 2: the key box (pure code, tests first)
- One new file pair: chain/keyVault.ts and keyVault.test.ts.
- Make fresh key material (secret, salt, signing key) with the
  device random source. Never Math.random.
- Lock it: password turned into a lock key with PBKDF2 (many
  rounds), sealed with AES-GCM (WebCrypto, built into every
  browser). Save only the sealed box in browser storage.
- Nasty tests first: wrong password fails, one changed byte
  fails, unlocked material never touches storage plain, a short
  password is refused with plain words (minimum 8 characters).
- Backup code: the sealed box also shown as one copyable code.
  Restore: paste code, set a password, same address comes back.
  Tests cover the full round trip.

## Task 3: screens (plain, no design work yet)
- Home gains a wallet area: Create my wallet (password twice,
  then the backup code shown once with a plain warning), Unlock,
  Lock, Restore from backup, Remove from this device.
- The wallet address shows in short form. Keys and the backup
  code never show again after the create step.
- Test sign in buttons move under a clear "Test accounts (local
  checks only)" label so no one mistakes them for the real thing.

## Task 4: wire the worker flow to the user wallet
- When a user wallet is unlocked, the worker role uses it
  instead of the test worker. Client and third test accounts
  stay for local two party checks until their own slice.
- The full local path runs again with the user wallet: invoice,
  pay from the test client, receipt read back, proof mark.
- Settings only: no new addresses typed in code. If the network
  changes, settings change, nothing else.

## Safety rules for the whole slice
- Keys never leave the device, never in logs, never in test
  data in the repo, never in analytics or error notes.
- No real money wording anywhere. Test networks only.
- Threat note written in the branch docs: what a thief with the
  sealed box still needs (the password), what a thief with the
  open page can do (same as any wallet: do not leave it open),
  what we cannot fix yet (forgotten password plus lost backup
  means the wallet is gone; the UI must say this in plain words
  before create, not after).
- OpenZeppelin craft read before contract touches. This slice
  touches no contract code unless Task 1 proves it must.

## Done means
- New tests pass, old suite passes, build clean, two self
  reviews, trial copy checked, owner walks create, unlock,
  restore on the trial copy before any merge.

## Progress
- Task 1 spike done 2026-11-18. Fresh random account: address
  made, same address back from the same keys in a new wallet
  (src/chain/freshAccount.test.ts, green). First send fails
  until the first fee is covered ("Not enough balance for fee
  payer"). Task 4 must add a fee sponsor step for first run;
  sponsored account creation already proved on public testnet.
  The send test stays skipped with the reason written in it.
- Task 2 done 2026-11-18. chain/keyVault.ts with 9 tests green:
  seal and open round trip, wrong password and one changed byte
  fail with one plain message, short password refused, backup
  code round trip, storage holds only the sealed box.
