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

## Progress
- Task 1 done 2026-11-19. Spike script at
  apps/web/src/chain/testnetSpike.test.ts, run against the
  public test network with the pinned contract and the
  sponsored fee. Two runs, same shape: node ready under 1s,
  wallet and fresh account made in about 1s each, and
  create_invoice landed in 23s then 21s. Real proving was on,
  on this small 2 core sandbox. Under the 2 minute stop line
  with room to spare. Note the read back wording above was
  loose: after create_invoice alone, read_receipts rightly
  shows count 0, because receipts record payments, and nobody
  has paid yet. Payment read back is Task 2. One script bug
  found and fixed during the spike (logging line), no app
  code touched.
- Task 2 done 2026-11-19. Spike at
  apps/web/src/chain/testnetStranger.test.ts. Two fresh
  wallets in two separate wallet programs, sharing nothing.
  Worker A made bill 387078 (22s). Client B paid it knowing
  only A address and the bill number (19s). A read the
  receipt at the first look: count 1, right bill, right
  amount. No sender registration, no wait, nothing extra
  shared. So P4 resolves in the best way: the version 2 pay
  link (worker address plus bill number) is enough, and
  nothing about the payer has to travel anywhere.
- Task 3 done 2026-11-19. The session now takes the user
  wallet in one chosen role (chain/wallet.ts userRole,
  workerFee and clientFee). Paying takes the worker address
  as an input (chain/payChain.ts). The panel offers Connect
  to make bills or Connect to pay a bill, shows the connected
  role, and has Disconnect. Wrong role actions are refused in
  plain words. A real bug was found by the live check and
  fixed: session wallets had proving off, which the local
  network accepts and the public network rejects as an
  invalid proof. Proving now follows the node address from
  settings (off local, on public). Live proof at
  apps/web/src/chain/testnetClientRole.test.ts: a stranger
  worker made bill 248422, the app session client paid in
  about 21s, the worker read the receipt back. Fast suite
  green, type check and build clean.
- Task 4 done 2026-11-19. Pay links are version 2 when the
  bill is written on chain: worker wallet address, chain
  bill number, amount, and title ride in the link
  (domain/payLink.ts). The invoice page builds the final
  link after the chain write lands. The pay page shows the
  short worker address before paying and pays to the link
  values through the session. Version 1 links still open and
  show the bill, but with a live session the page says an old
  link cannot be paid on the network and asks for a new one.
  Decoder is strict: a link claiming version 2 with a bad
  address or bill number is broken, and extra fields in a
  link are never read back out. Live proof at
  apps/web/src/chain/testnetPayLink.test.ts: stranger worker
  made bill 116075, the app session client paid by link
  values in about 28s, receipt read back. Fast suite 61
  green, type check and build clean.
- Task 5 done 2026-11-19. The test sign in area is gone from
  the home page, signInTestAccount is deleted, and no app
  screen can reach a test account. The session comment states
  the rule so nobody wires them back in. Test account flows
  (localFlow, userFlow, proof tests) are relabeled PLUMBING
  CHECK ONLY in their headers. Stale page words went with
  them: no more "wrong test account" advice, and pages say
  "the network" instead of "the local network", which stays
  true when Task 7 flips the settings. A new home page test
  proves no test sign in is offered and the wallet and main
  actions remain. Fast suite 63 green, type check and build
  clean.
- Task 6 done 2026-11-19. Bills save on the device under one
  named storage key (private-pay-proof.bills.v1) and load
  back at start, so a refresh keeps them. Storage holds
  bills only, checked by a scan test. Damaged or wrong
  shaped stored text loads as an empty list. A blocked or
  full storage never breaks making a bill; the bill just
  will not survive a refresh. Claims stay in page memory
  for now; the proof link carries the claim. Fast suite 67
  green, type check and build clean.
- Sepolia note: the owner holds Sepolia test accounts. They
  are the fallback if the sponsored fee path ever fails (fee
  money can be claimed from Sepolia). Keys never come into
  chat. Any step needing those accounts is done by the owner.

- Task 7 settings done 2026-11-19. Preview env on the
  Vercel project now carries VITE_AZTEC_NODE_URL (public
  test network node) and VITE_AZTEC_CONTRACT_ADDRESS (the
  pinned contract). Trial deployment dpl_69XLy1bxfYTiKhhWYuRLQpGE9z5C
  is READY and its build record shows both settings present.
  Production env stays untouched until after merge.
- Scripted acceptance run done 2026-11-19, through the real
  app session code (apps/web/src/chain/testnetAcceptance.test.ts).
  Two wallets in two storages. Worker connected in 7s, bill
  written in 21s, client connected in 4s, paid by link
  values in 19s, worker reconnected fresh in 5s, receipt
  read in 1s with count 1 and the right bill and amount.
  Still open before merge: the same walk in two real
  browsers on the trial copy, by the owner. Browser proving
  times are only known when that walk happens.

- Browser bug found by the owner walk 2026-11-19, fixed the
  same day. The browser allows only one wallet store per
  site, and the app session was opening three wallet engines
  in one page, a leftover of the test account flow. The
  owner hit "SQLite-OPFS pool already in use" on connect.
  Fix: the app session is now exactly one wallet, the
  user's own (chain/wallet.ts createUserChainSession), and
  ending or replacing a session closes its wallet store
  (wallet.stop). Chain calls take a small actor shape
  (contract, account, fee) so plumbing checks can still
  build test actors without the app ever doing so. If a
  second tab still holds the store, connect now says so in
  plain words. Fast suite 67 green, type check and build
  clean, and the scripted acceptance run passed again after
  the fix (connects got faster: 2 to 4s, one wallet instead
  of three). Owner re-walk on the rebuilt trial copy is the
  remaining step before merge.

- Second browser bug found by the owner walk 2026-11-19,
  fixed the same day. The invoice page showed a version 1
  link at once, then swapped in the final version 2 link
  after the network write. The owner copied the early link,
  so browser two could only mark the bill paid on that
  device. No network payment happened, and browser one
  correctly read no receipt. Fix: with a live session the
  invoice page shows no link until the network write lands,
  the Make invoice button locks while writing, and only the
  final link is shown. The bill now keeps its network pay
  target (worker address and chain bill number, both public
  pay information, never keys), so My pay can show the final
  link again after leaving the page or refreshing. The pay
  page now runs the network pay first and marks the bill
  paid only after it lands; an old link no longer marks the
  bill paid. A fresh page also asks the network how many
  bills the wallet already has before choosing the next
  bill number, so a reload cannot reuse a number the
  network would reject. Fast suite 70 green, type check and
  build clean, scripted acceptance passed again (bill 21s,
  pay 21s). Owner re-walk with a new invoice is the
  remaining step before merge. The first trial bill stays
  unpaid on the network; its early link cannot be repaired.

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
