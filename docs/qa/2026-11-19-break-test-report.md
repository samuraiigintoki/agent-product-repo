# Break test report: real flow milestone

Date: 2026-11-19
Code tested: branch feat/real-flow-testnet at 2fd253f.
Owner browser result before this campaign: the main two
browser workflow passed.

## Short verdict

The main path works. The milestone is not ready to merge.

The break runs found faults that can make a screen say the
wrong thing about pay, lose bills, mix worker and client
bills, block wallet recovery, or leave a worker unable to
use a real receipt. The chain contract itself held up in
the live attack set.

No production change was made. No merge was made.

## What ran

### Existing suite

- Fast suite: 70 passed.
- Type check: clean.
- The fast suite does not include the live chain tests.

### Local crowd run

This was a local run. It was not 240 live chain users.

- 120 worker side stores and 120 client side stores.
- 255 bills were made and opened on client stores.
- 510 repeat link opens were run.
- The same link opened three times still made one bill.
- Bills with long titles and non English letters opened with
  the same amount and pay target.
- One store held 200 bills, saved, and loaded them back.

Passed: repeat opens, varied bills, and 200 bill load.
Failed cases are listed below.

### Link change run

- 200 one character changes were made to a real pay link.
- 15 changed links still opened.
- 3 changed at least one carried field.

This is not a surprise by itself. A pay link is plain text
with no seal. Any person can also build a new well shaped
link from parts. The contract still checks the amount for
the named worker and bill number, and the live run below
shows that check working. The screen risk is different: a
person can be shown one bill and sent to another real bill.
The bill id clash case below shows that risk in the app.

### Screen and session probes

20 probe tests were run against the real pages, the real
domain store, and mocked network sends. 4 passed and 16
failed. The mocked part was only the network send, so page
state faults are app faults, not network faults.

Passed probes:

- A network pay that fails leaves the bill unpaid.
- A network pay that lands marks the bill paid after it.

The rest failed for the reasons below.

### Live chain attack set

Fresh wallets were made in memory. No keys were stored.
One worker and one client ran on the public test network.

- Pay a bill that does not exist: rejected in 3 seconds.
- Wrong amount: rejected in 3 seconds.
- Wrong worker: rejected in 1 second.
- Right pay: landed in 20 seconds.
- Second pay of the same bill: rejected in 4 seconds.
- Worker read back one receipt with the right bill and
  amount.

The contract rules held for this small set. This was not a
crowd run and it does not prove browser scale.

## Blockers before merge

### B1. A client can use up the paid mark before connecting

Open a version 2 pay link with no wallet session and press
Pay. The page marks the bill paid on that device and then
shows Paid. Thank you.

After that, the client can unlock and connect, but the bill
still shows as paid and there is no pay button left. The
network pay never ran, and the normal screen path cannot
run it after that.

Fix shape: a version 2 link must not take a device only
paid mark. It should ask the client to connect first and
stay unpaid until the network pay lands.

Risk in the fix: old version 1 links need a clear device
only path, or they become dead links with no warning.

### B2. The shown amount can differ from the paid amount

A client store was first given a fake bill with amount 1.
A real link then arrived with the same bill id, amount 500,
and a real worker target.

The store kept the fake bill. The page showed the fake
amount, but the pay call used the real link amount and
target. A screen can therefore say 1 while the pay call
says 500.

Fix shape: if a link bill id is already on the device and
any field differs, stop. Show a clash message. Do not pay.

Risk in the fix: a worker opening their own link on their
own device must still work when the fields truly match.

### B3. Wallet connect races can beat a lock

Two session races were reproduced with a slowed wallet
open and close.

- Start connecting, lock the wallet before the connect
  lands, and the session still ends connected as worker.
- Disconnect, then connect again at once, and the new
  wallet store can start before the old store has closed.
  That is the same family as the store already in use fault
  the owner already hit.

Fix shape: one session change at a time. Wait for the old
wallet to close. Check the wallet is still open after a
connect lands, and drop the session if it is not.

Risk in the fix: a stuck close must not lock the person out
forever. The fix needs a clear timeout and message.

### B4. A damaged wallet box is a recovery dead end

When the stored wallet box is damaged, the wallet panel
shows only the unlock form. There is no restore button and
no remove button until a wallet is open.

A person with a good backup code cannot use it from that
screen. A person who lost the password cannot clear the
damaged box from that screen either.

Fix shape: always offer restore and remove, with a clear
warning before either one replaces or clears the box.

Risk in the fix: restore over an existing box can destroy
the only copy of a wallet. It needs a strong confirm step.

### B5. Worker receipts stop at the first receipt

The chain read returns one receipt only: the first receipt
note, plus a count. The My pay screen shows that one bill
and amount. In a probe with count 3, the screen still only
showed the first bill and never showed the count.

Worse, the receipt is not tied back to the local bill. In a
probe, a receipt for bill 2 and amount 500 arrived, the
screen showed it, and the local bill stayed Not paid yet.
Make proof only lists locally paid bills, so the worker
cannot make proof from a bill the network says was paid.

Fix shape: read all receipts, match each one to the local
bill by chain bill number and amount, and only then mark
the local bill paid. This needs a contract read change and
a new test network contract, or a different receipt read
path. It must be planned as its own step.

Risk in the fix: a new contract address leaves old bills on
the old contract. On the test network that is acceptable
only if named plainly before the switch.

### B6. Bad invoice input has no working fault path

The invoice form has field fault text ready, but the click
path never sets it. Empty titles and bad amounts reach the
store, throw, and leave the person with no message. The run
also showed an unhandled error from the click.

Typing 1,250.50 also fails. The amount parser that accepts
commas exists in the domain code, but the form does not use
it. A fast double click with no session made two bills.

When a network write fails, the bill stays on the device
with no network target and no way to write that same bill
later. Making a new invoice is not a retry. It is a second
bill.

Fix shape: check fields before saving, use the amount
parser, lock the button in all states, and give a saved
bill a Write on network action after a failed write.

Risk in the fix: retry must reuse the same bill id and the
same chain bill number. A retry that makes a new bill is
the fault again.

### B7. The proof page can call a self made claim Valid

A claim was made from a bill that was only marked paid on
the same device. No network pay stood behind it. The check
page still showed the large green Valid word, because the
word check is only a device seal and no network mark was
checked on that screen.

This is the known seal limit, but the screen word is too
strong for what was checked.

Fix shape for this milestone: do not show the plain Valid
word unless the network mark has also matched. Without a
network check, say that only the words match. The full
unforgeable proof stays in its later slice.

Risk in the fix: third parties with no wallet cannot run a
network check yet. The screen must say not checked, not
broken.

## High faults after the blockers

### H1. Two tabs can lose a bill

Two stores were opened on the same browser storage. Each
made one bill. After reload, only the second bill was
there. Each tab saves its own whole list, so the last save
wins.

### H2. Stored bills accept duplicate ids

Storage with two bills sharing one id loaded both bills.
Bill lookup, pay, proof, and chain bill numbers all trust
that id, so two records with one id can split the truth.

### H3. One damaged stored bill wipes every bill

Storage with one good bill and one damaged record loaded
as an empty list. Nothing crashed, which was the old rule,
but one bad record should not erase sound bills.

### H4. Worker and client bills share one list

The store has one bill list. Bills a worker makes and bills
a client imports both live in it. My pay shows all of them
as if they were the worker's own bills. After the last fix,
an imported unpaid bill can even show a Send this network
pay link block on the client device.

Make proof also lists any locally paid bill, including one
the person paid as a client.

Fix shape: each bill needs a side: made by me, or sent to
me to pay. My pay and Make proof should read only made by
me bills. The pay page should read sent to me bills.

### H5. Bills are not tied to the wallet that made them

Bills stay on the device when a wallet is removed or a
different wallet is restored. A network bill keeps its old
worker target, while Read my pay uses the wallet that is
open now. On a shared device, or after restoring a second
wallet, the bill list and the open wallet can quietly
belong to different people.

### H6. The wrong role reason is swallowed

With a wallet connected to make bills, pressing Pay on a
pay page gave only the general did not finish message. The
clear role message from the session was thrown away by the
page catch. The person is not told to disconnect and
connect as client.

### H7. A landed pay can still look unpaid after a lost reply

The pay page marks the bill paid only after the send call
returns. If the send lands but the reply is lost, the bill
stays unpaid on the device. Pressing Pay again hits the
contract already paid rule and still shows did not finish.
There is no check that asks the contract whether this bill
is already paid before giving up.

## Code audit notes, not live proof

- Amounts use plain numbers. A typed amount above the safe
  whole number range loses its exact value before it ever
  reaches the chain. Amount input needs a safe range check.
- The public bill book stores a hash of amount and bill
  number. Bill numbers are small and amounts are often
  round, so a person who knows a worker address can guess
  common amounts and test them against the hash. This is a
  privacy limit of the current contract shape.
- No asset moves in pay_invoice. The call records that a
  pay was made and blocks a second one. That matches fake
  test money, but no screen should imply real funds moved.
- Wallet buttons other than invoice and pay have no busy
  lock. The session race is proven. The same double click
  shape exists on create, unlock, restore, and connect.
- Settings faults were not run. A bad node address or a
  hanging node can still leave Connect with no cancel and
  no timeout of its own.

## Words that do not match the build

- The pay page says: Fake test money only. This pay step is
  private in the real build. The trial copy is the real
  build for this milestone, so the second sentence reads as
  if the person is in the wrong place.
- Home says the buttons work on this device until a wallet
  is connected. It does not say that a version 2 link opened
  too early can block the network pay. B1 covers the fix.

## What did not run

- No 100 to 200 live browsers, devices, or chain wallets.
- No live crowd on the public test network.
- No low memory phone run.
- No browser crash in the middle of proving.
- No public node outage or rate limit run.
- No shared device test with two people and two wallets.
- No screen reader or keyboard only pass. That belongs to
  the design slice, but it has not been checked at all.

## Fix order

1. Pay truth first: B1, B2, and H7. One bill, one amount,
   one target, and no paid word before the network says so.
2. Session and wallet safety: B3 and B4.
3. Form and storage truth: B6, H1, H2, and H3.
4. Side split and wallet tie: H4 and H5. Do this before
   more bills pile up in the wrong list.
5. Receipts in full: B5. This is a contract step and needs
   its own plan and owner say so before a new contract.
6. Proof words now, proof strength later: B7 wording in
   this milestone. The unforgeable proof stays parked.
7. Run this campaign again, then the owner two browser
   walk again, before any merge.

## Merge call

Hold the merge. The happy path passing is real, and the
contract attack set passing is real. The blockers above
are also real, and each one can make the app state a thing
that did not happen, or hide a thing that did.
