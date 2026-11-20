# Fix all plan for the break test findings

Date: 2026-11-19
Branch: feat/real-flow-testnet
Source report: docs/qa/2026-11-19-break-test-report.md

## Aim

Fix every app fault in the break test report, then run a
harder campaign than the first one. The owner browser walk
runs again after the fixes. No merge and no production
change in this work.

## Contract skill note

The OpenZeppelin secure contracts skill was read before
contract work. It has no Aztec or Noir contract skill. Its
craft carries over: read the project first, prefer tested
parts, make the smallest change, and check conflicts. Its
Solidity code does not drop into this Noir contract.

## Steps, and the new problem each step could create

1. Pay truth. A version 2 link cannot be marked paid with
   no client session. A bill id clash stops the pay. A lost
   send reply is checked against the contract paid flag
   before the bill is called unpaid.
   New problem: strict rules can strand old links.
   Guard: version 1 links keep a plain device only path.
   Version 2 links say connect first and stay unpaid.
   Stop if any test shows a paid mark before a network pay.

2. Session and wallet safety. Session changes run one at a
   time. A connect that lands after a lock is dropped. The
   old wallet store must close before a new one opens.
   Wallet buttons lock while work runs. A damaged wallet
   box still offers restore and remove, with confirm steps.
   New problem: a stuck close can lock a person out.
   Guard: session changes have a plain timeout message and
   never hold key material after a lock.
   Stop if a race test can still connect after lock.

3. Invoice form and retry. Fields are checked before a
   bill is saved. Comma amounts work. Amounts must be safe
   whole numbers. Long titles and client marks are capped.
   The button cannot make two bills from one double click.
   The chain bill number is saved as an attempt before the
   send, so a failed or cut off write can retry the same
   bill from My pay.
   New problem: retry can write the same bill twice.
   Guard: before a send, check whether that worker and bill
   number is already written, and treat a match as done.
   Stop if retry changes the bill number.

4. Bill store safety and sides. Sound stored bills survive
   one damaged record. Duplicate bill ids are dropped on
   load. Two tabs merge before saving, and a paid record
   wins over an unpaid copy of the same bill. Every bill is
   marked made by me or sent to me. My pay and Make proof
   read made by me bills only. Bills with a network target
   for another wallet are not shown as this wallet's bills.
   New problem: merging can bring back a stale bill.
   Guard: merge only by bill id, paid wins, network target
   fills only empty fields, and no record is deleted by a
   merge. Stop if a merge can unpay a bill.

5. Receipts for every local bill. Use the contract paid
   flag for each made bill, matched by worker address and
   chain bill number. Mark only the matching local bill
   paid. Keep the first receipt read as extra detail.
   New problem: checking 200 bills one by one can be slow.
   Guard: check only made bills with a network target, show
   reading state, and record the time in the campaign.
   Stop if a paid flag can mark a bill with a wrong amount.

6. Proof words. A proof with no network check no longer
   shows the plain Valid word. It says the words match and
   the network was not checked. A network mismatch shows
   not valid. Bad proof payload shapes fail as broken, not
   as a crash or a pass.
   New problem: honest words can look weaker than before.
   Guard: say exactly what was checked in one short line.
   The unforgeable proof stays in its later slice.

7. Small truth fixes. The wrong role message reaches the
   pay page. The pay page drops the stale real build line.
   Bad contract settings fail in plain words. Connect has
   a timeout message. Storage save failure is shown on the
   invoice page instead of staying silent.
   New problem: plain messages can hide a fault a builder
   needs. Guard: keep the plain message for people and log
   nothing with keys, passwords, or backup codes.

8. Harder campaign. Repeat the first campaign, then add:
   400 local users, storage tabs racing pays and writes,
   link clash packs, refresh during write, lost pay reply,
   wrong role on every page, damaged wallet recovery, 200
   bills checked for pay flags with mocked sends, and a
   live chain set with two bills paid out of order.
   New problem: a bigger local crowd can still not prove
   live scale. Guard: label local and live results apart.
   Stop the live set after 20 minutes.

## What this plan does not change

- No real asset moves. This milestone still records a pay
  on the test network with fake test money.
- The public amount hash can still be guessed for common
  amounts by someone who knows the worker and bill number.
  Fixing that needs a new contract shape with a random
  amount guard, a new contract deploy, and new links. That
  deploy needs its own owner approval and is not hidden in
  this fix pass.
- The proof seal is still not unforgeable. Step 6 fixes
  the words only, as planned for this milestone.

## Done means

- Every blocker and high fault in the report has a failing
  test first, a fix, and a passing test after.
- The old fast suite stays green.
- The harder campaign is written up with numbers.
- The live chain set passes with fresh wallets.
- The trial copy is rebuilt and the owner walks it again.
