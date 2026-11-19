# Real flow on the public test network: short plan (needs owner yes before code)

Goal: the full path works for real. A worker with their own
wallet makes a bill. A client with their own wallet, on another
device, opens the link and pays. The worker reads the receipt
back. All on the public test network, in real time, with no
test accounts anywhere in the app flow. UI work waits until
this is true.

Owner rules this plan follows:
- Fully working, scalable, and secure before UI and UX.
- No test accounts hardwired into the app testing flow.
  Testing is real time, real wallets, real data shape.
- Come with a concrete plan that solves the problem. Each
  task below names the new problem it could create and the
  guard against it. If a guard fails, stop and replan with
  the owner. No quiet problem trading.

## The problems, in the order they block a real user

P1. The live site points at a network program on the same
computer (localhost). Nobody else has that program, so
connect times out for every real visitor.
P2. The client still pays from a shared test account. A real
client has no wallet in the flow at all.
P3. The pay link carries title and amount only. A client
wallet on another phone does not learn who to pay or which
bill number on chain to pay.
P4. Two wallets that have never met may not see each other.
When a stranger pays, the worker wallet may not find the
receipt note until it knows the payer address. This is
unproven either way today.
P5. Test sign in buttons ship in the app. They train people
to trust shared keys and they hide whether the real flow
works.
P6. Bills live in page memory only. A refresh loses them.
(Pay links carrying their own bill softened this for the
client, not for the worker who made the bill.)
P7. Nobody has timed a real send from a browser wallet on
the public test network. It may be slow. We must know the
number before we call this usable.

## Task 1: spike, one real wallet send on the public test network
- From a plain script, no app code: fresh random wallet,
  sponsored fee, one create_invoice call against the public
  test network node, through the pinned contract already
  deployed there (settings only, addresses from settings).
- Measure: does the send land, how many seconds, does the
  receipt read back.
- New problem this could create: none in the app. It writes
  one test bill on a test network with fake money.
- Stop rule: if a browser style wallet cannot send on the
  public network, or one send takes longer than a person
  would wait (we say over 2 minutes), stop. Report the
  numbers to the owner and replan. Do not build Tasks 2 to 6
  on a path that does not move.

## Task 2: spike, two wallets that have never met
- Two fresh wallets in two separate wallet programs, no
  shared session. Wallet A makes a bill. Wallet B pays it,
  using only the worker address and bill number.
- Check: can A read the receipt back. If not, try A learning
  B address (the way Task 5 in the old build needed sender
  registration) and check again.
- Write down exactly what information B must hand to A for
  the receipt to be found, in plain words.
- New problem this could create: the fix could leak who paid
  to people other than the worker. Guard: whatever address
  sharing the spike proves necessary travels only between
  payer and worker (inside the pay step), never in a public
  place, never in the checker link.
- Stop rule: if the receipt can only be found by sharing
  something a stranger could misuse, stop and replan.

## Task 3: the client wallet joins the session
- chain/wallet.ts: the session takes the user wallet for one
  chosen role, worker or client, not only worker. The other
  role keeps no account at all in the app flow (see Task 5).
- chain/session.ts: signInWithUserWallet takes the role.
  Paying from a user client pays its fee through the sponsor
  too, same as the worker does today.
- chain/payChain.ts: pay takes the worker address and bill
  number as inputs, instead of reading them from the session
  worker. This is what lets another device pay.
- WalletPanel: the connect step stays one button. The role
  comes from where the person is heading: making invoices
  connects as worker, opening a pay link connects as client.
  The panel says which role is connected in plain words.
- Nasty tests first: paying with a locked wallet is refused;
  paying a different amount than the bill is refused by the
  contract call path; key material never appears in any
  stored value or link (test scans storage and link text).
- New problem this could create: one device holding a wallet
  that can act as both sides could confuse who paid whom.
  Guard: one session, one role, chosen at connect, shown on
  screen. Switching role means reconnecting. Test covers it.

## Task 4: pay link version 2 carries the real pay targets
- domain/payLink.ts: the link now carries worker wallet
  address, chain bill number, amount, and work title. Old
  links (version 1, no address) still open and show the bill,
  but paying on chain asks for the new link. Plain words on
  screen say why.
- The chain bill number is added when the bill is written on
  chain, so the worker page builds the final link after the
  write lands and shows that link. In fake mode (no session)
  the link stays version 1 and the page says the bill lives
  on this device only, same honesty as today.
- Invoice.tsx, Pay.tsx: use the version 2 fields. Pay page
  shows who will be paid (short address) before paying.
- Nasty tests first: a link with a changed address or amount
  fails plain checks or the contract amount rule; a garbled
  link fails in plain words; no key shaped text can ride in
  a link (the encoder takes only the four named fields).
- New problem this could create: links get longer and uglier.
  Accepted for now. Short links are a UI slice concern.

## Task 5: test accounts leave the app
- Home.tsx: the test sign in area is removed.
- chain/session.ts: signInTestAccount is removed if nothing
  in the app uses it after the buttons go. Code tests keep
  building test sessions directly, that is test code, not
  app flow. The split is stated in one comment so nobody
  wires them back in by habit.
- Fast tests updated to match. The old live test flows that
  used test accounts stay as plumbing checks only and are
  renamed so nobody reads them as product proof.
- New problem this could create: local checking gets slower
  because every check needs real wallets. Accepted. That is
  the owner rule, real testing only.

## Task 6: bills survive a refresh
- domain/store.ts: bills save to browser storage on the same
  device and load back at start. Storage holds bills only:
  title, amount, dates, paid state. Never keys, never backup
  codes. A version name on the storage key, one named home
  for it in settings or store constants.
- Tests first: reload gives the same bills; damaged stored
  text loads as an empty list with no crash; stored text is
  scanned and holds nothing key shaped.
- New problem this could create: stale bills on a shared
  device. Guard: bills are not secrets in this product (the
  private part is the payment), and removing the wallet does
  not claim to erase bills. The wallet panel keeps its own
  honest wording. If the owner wants bills behind the wallet
  lock, that is a named later choice, not a silent add.

## Task 7: point the trial copy at the public test network
- Vercel env settings for the preview copy only:
  VITE_AZTEC_NODE_URL to the public test network node,
  VITE_AZTEC_CONTRACT_ADDRESS to the pinned contract. No
  code change. Production env waits until after merge, same
  gate as always.
- Rebuild the trial copy and run the acceptance run below.

## Acceptance run (the only proof that counts for this slice)
On the trial copy, in two separate browsers or devices:
1. Browser one: create a wallet, connect as worker, make a
   bill for a real shaped job (title and amount), copy the
   final link.
2. Browser two: create a different wallet, open the link,
   connect as client, pay.
3. Browser one: My pay shows the receipt for that bill.
4. Lock both wallets. Unlock. Bills and receipt still read
   true after refresh.
Time each chain step and write the times in this plan.
Any step failing means the slice is not done, whatever the
unit tests say.

## Known limits that stay, named on purpose
- The proof is still the device side tamper seal. The
  unforgeable on chain proof is its own later slice.
- The fee sponsor pays fees on test networks by design. It
  is not a main network answer.
- The contract receipt read shows count and latest receipt
  shape today. A richer history may need contract work in
  the dashboard slice. Not expanded here.

## Done means
- Tasks 1 and 2 spikes written down with real numbers.
- New tests pass, old suite passes, type check and build
  clean, two self reviews, trial copy on public testnet
  settings, acceptance run done in two browsers with times
  recorded, owner walks create, pay as client, and receipt
  on the trial copy before any merge.
