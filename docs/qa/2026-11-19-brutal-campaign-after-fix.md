# Brutal campaign after the break test fixes

Date: 2026-11-19
Code tested: branch feat/real-flow-testnet at d3d4889,
plus the live test file added with this report.
Source: docs/qa/2026-11-19-break-test-report.md and
docs/superpowers/plans/2026-11-19-fix-all-break-test-findings.md

## Short verdict

Every blocker and high fault from the first report now has
a fix and a passing test. The harder campaign below found
three more truth gaps, and those were fixed in the same
pass. The fast suite is 110 passed, the type check is
clean, and the build passes.

This is still not a merge call. The owner browser walk
runs again on the rebuilt trial copy first, and the owner
approves any merge and any production change separately.

## What ran

### Fast suite (local, mocked network sends)

- 25 test files, 110 tests, all passed.
- Type check clean. Build passed.
- The fast suite does not include the live chain tests.

### New brutal local campaign (18 tests)

Local only. In-memory stores and mocked network sends.
This is not a live crowd and proves nothing about live
scale.

- 400 local users: 200 worker stores and 200 client
  stores. 600 repeat link opens. The same link opened
  three times still made one bill, and the shown amount
  always matched the amount that would be paid.
- Two tabs racing: 200 interleaved writes plus pays on
  one shared storage. After reload all 202 bills were
  there once each, paid beat unpaid, and a network paid
  mark beat a device only paid mark from a stale tab.
- Link clash pack: changed amount, title, worker, or
  bill number against a bill already on the device all
  stopped with a clash. The stored bill was untouched.
- Malformed link pack: unsafe amounts (above the safe
  whole number range), decimal amounts, oversized
  titles, bad bill numbers, bad worker addresses, and
  wrong versions all decode as broken links.
- Link mutations: one character changes across a real
  link. 20 changed links still decoded, and every one
  showed exactly the amount it would pay. The contract
  check remains the guard against paying a bill that
  was never written.
- Damaged storage pack: 100 sound bills survived lying
  records mixed in with them. A paid record whose paid
  amount did not match, an unpaid record carrying a
  paid amount, a chain target with no worker, an unsafe
  amount, a duplicate id, a bad paid date, and an
  unknown side were all dropped on load.
- Amount edges: "1,250" and spaced amounts parse.
  Zero, negative, decimal, text, empty, and unsafe
  amounts fail with a field fault. Title and client
  mark caps hold at 120 and 80 characters.
- 200 bills checked for pay flags at store level: only
  the exact matching bill was marked. One view lying
  about its amount marked nothing.
- Pages under attack: a double click paid once; a
  device only mark from before the fix no longer blocks
  the real network pay; a lost pay reply was rechecked
  against the network before the bill was called
  unpaid; the wrong role message reached the person on
  both the pay page and the invoice page.
- Refresh during write: the reserved chain bill number
  survived a fresh store on the same storage (as after
  a refresh or crash), and the retry from My pay wrote
  that same bill. No second bill was made.
- My pay with 200 bills and mocked network views: half
  paid, every mark tied to its own bill, about 1.4
  seconds locally. Another wallet's network bills were
  hidden and never written over.
- Proof check pack: malformed, tampered, and expired
  proofs never showed the plain Valid word. A sound
  claim with no network check showed "Words match
  only."
- Damaged wallet recovery, end to end: a real wallet
  was made, its stored box was damaged, and the panel
  restored the same wallet from its backup code (same
  key material) after the replace confirm. A tampered
  backup code restored nothing, and remove cleared the
  box after its confirm.

### Live chain sets (public test network, fresh wallets)

Fresh wallets in memory only. No keys stored. Small
samples, not crowd runs.

- Two bills paid out of order: bill 2 paid first (18s),
  then bill 1 (25s). After the first pay, bill 2's paid
  flag was true and bill 1's was still false. After the
  second, both were true. Receipt count reached 2, and
  the first receipt was bill 2 for 800. A second pay of
  bill 2 was rejected (2s). Total 96s.
- Scripted acceptance rerun: worker connected, bill
  written, client connected and paid (20s), worker
  reconnected fresh and read the receipt back. 49s.
- Original live attack set rerun: missing bill, wrong
  amount, and wrong worker pays rejected; the right pay
  landed (18s); a second pay was rejected (3s). 56s.

One earlier live attempt failed before any chain work:
the sandbox had no test network settings, so the code
pointed at a local node that is not running here. The
reruns above set the public test network node and the
pinned contract address from the milestone record.

## Faults found by this campaign and fixed in the same pass

1. A device only paid mark could still hide the real
   network pay on a version 2 link after reconnecting.
   The pay page now shows the network pay again until
   the network itself has said the bill is paid. Bills
   gained an explicit network paid mark, and a network
   truth now wins over a device mark when two tabs
   merge.
2. My pay and Make proof could call a bill "Paid in
   full on the network" just because it had no paid
   date. That wording now needs the network paid mark;
   otherwise the bill is only "Paid in full."
3. Pay link decoding accepted amounts above the safe
   whole number range and titles longer than the bill
   store keeps, so a link could show a bill that a
   refresh would drop. Decoding now applies the same
   limits as the store.
4. Stored bills could lie: a paid state with a paid
   amount that did not match, or a chain target with
   no worker to pay. Both shapes are now dropped on
   load instead of shown.

Also fixed while rereading the fixed code: chain bill
numbers are now scoped to the wallet that reserved
them, so a wallet switch cannot carry another wallet's
bill numbers; a lock landing mid-write stops the write
from reporting success; and a failed network read on
My pay now says so and offers a retry instead of
leaving the panel stuck on reading.

## What this campaign still does not prove

- No 100 to 200 live browsers, devices, or chain
  wallets ran. The 400-user crowd is local stores only.
- No low memory phone, browser crash during proving,
  public node outage, or shared device run.
- The public amount hash can still be guessed for
  common amounts by someone who knows the worker and
  bill number. Fixing that needs a new contract shape,
  a new deploy, and new links: its own owner approval,
  not hidden in this pass.
- The proof seal is still a device side tamper seal.
  This pass fixed the words only. The unforgeable
  proof stays in its later slice.
- No real asset moves. Pay records a mark on the test
  network with fake test money, and screens must keep
  saying so.
- Receipt reading still returns the first receipt plus
  a count. Per-bill truth comes from the contract paid
  flag per bill, which is what the screens now use.

## Next step

Owner walks the rebuilt trial copy in two browsers
again (worker and client), then decides on merge.
Production stays untouched until the owner approves
the merge and the production settings change.
