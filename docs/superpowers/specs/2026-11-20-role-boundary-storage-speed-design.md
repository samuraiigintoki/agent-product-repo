# Design: worker and client boundary, browser storage fallback, bill speed

Date: 2026-11-20
Branch: fix/role-boundary-storage-speed
Owner walk findings on production (main at cf9e047) drove
this design. The owner approved building it on 2026-11-20.

## Why

The owner walked the live worker and client flow and found
three faults:

1. Making a bill takes more than 30 seconds on the worker
   side, with no clear sign of what is happening.
2. After making a bill, the worker screen offers a way into
   the pay page. The worker lands on the client pay screen
   and only then gets told this wallet is connected to make
   bills. The two roles are mixed on screen.
3. On the payer side, in a different browser, connecting to
   pay fails with the raw words "Security error when
   calling GetDirectory". The payer cannot pay at all.

## What the investigation found (evidence, not guesses)

### The GetDirectory failure

- The wallet engine the app uses in a browser keeps its
  private data in a browser storage area called OPFS. The
  code path is visible in the pinned packages: the browser
  wallet entry opens an OPFS store for the wallet data and
  for the PXE data, and the bundled SQLite code calls
  navigator.storage.getDirectory().
- Browsers refuse that call with a SecurityError when site
  storage is blocked, when the window is a private window
  in some browsers (Firefox private windows are the known
  case), or when the page origin cannot hold storage.
  The words the owner saw are the Firefox wording for this
  exact refusal.
- The app chose OPFS stores only, with no fallback, and
  the wallet panel printed the raw browser error. So one
  whole class of payer browsers was locked out, and the
  message gave no path forward.
- The pinned Aztec version also ships an IndexedDB store
  for the same job. It needs no OPFS. The wallet engine
  accepts a chosen store for both its data stores.

### The mixed roles

- The session layer knows one wallet holds one role, and
  its actions already refuse the wrong role. The pages do
  not know. The pay page draws the pay form for anyone and
  only fails after the pay button is pressed.
- The invoice result and My pay both offer "Open pay
  page", which walks a worker into the client screen.
- Nothing recognises the worker's own bill link, and
  nothing stops a wallet paying its own bill.

### The slow bill

Live timings were measured through the real app session
code on the public test network (Node, this machine):

- Make wallet keys: 0.2 seconds.
- Connect as worker: 3.4 seconds.
- Reserve a bill number (one network read): 1.2 seconds.
- Write bill 1 (already-written check, then the private
  send): 18.1 seconds.
- Write bill 2 in the same session: 27.3 seconds.

So the send itself is the cost. Writing a bill is a
private contract call, and on a public network the device
must build a real proof for it. That proof work happens
in the browser and is slower than on this test machine,
which is why the owner saw more than 30 seconds. The
proof cannot be removed without changing the privacy
shape of the contract, which this design does not do.

Two smaller network reads sit in front of the send. The
bill count read is needed once per wallet per session.
The already-written check is only needed on a retry, but
today it also runs for a brand new bill, where the answer
is known. That wasted read comes out.

## Goals

- A payer in any current browser that allows site data
  can connect and pay, including Firefox private windows.
  Where a browser blocks all site storage, the person
  gets plain words that say what to change, never a raw
  browser error.
- Worker and client are separate on screen, not just in
  the session layer. No page draws the other role's main
  action. A worker never lands on a working pay form, a
  client never lands on a working bill form.
- A wallet cannot pay its own bill, on screen or through
  the session calls.
- Making a bill drops the wasted network read, and every
  long network step shows what it is doing and how long
  it has been running.
- No contract change, no new deploy, no change to what
  moves on chain. Fake test money only, as before.

## Non-goals

- No change to the contract, its privacy shape, or the
  amount hash question. Those stay parked for their own
  owner decision.
- No promise that proving gets fast. The design removes
  wasted work around it and tells the truth while it
  runs. A separate threading trial was offered and the
  owner did not pick it.
- No new pages and no design pass. Wording and layout
  follow the current plain style.

## The flow boundary (what each person sees)

One wallet, one role at a time. The session layer already
enforces this for actions. The pages now enforce it for
screens too.

### Pay page, network (version 2) link

- No wallet connected: bill summary, a line saying connect
  as client first, and a button to the home page. No pay
  button. The bill is not marked paid.
- Connected to make bills, and the link is this wallet's
  own bill (link worker address equals the connected
  wallet): a "This is your bill link" screen. It shows the
  bill, the full link with a Copy link button, and a
  button to My pay. No pay form.
- Connected to make bills, and the link belongs to
  another worker: a boundary screen saying this wallet is
  connected to make bills, with a Switch to paying bills
  button (disconnect, then connect as client; the wallet
  stays open) and a Go home button. No pay form.
- Connected to pay bills, and the link pays this same
  wallet: "You cannot pay your own bill." No pay form.
- Connected to pay bills for another worker: the pay form
  as today, with the paid checks as today.

Old version 1 links keep their device only path when no
wallet is connected, as before.

### Worker pages (New invoice, My pay, Make proof)

- Connected to pay bills: a boundary screen only. It says
  this wallet is connected to pay bills, with a Switch to
  making bills button and a Go home button. No forms, no
  bill lists.
- No session or a worker session: the pages work as
  today.

### Worker result screens

- "Open pay page" is removed from the invoice result and
  from My pay. In its place: the link, a Copy link
  button, and one line telling the worker to send the
  link to the client, who opens it in their own browser.
  My pay also keeps its "Write this bill on the
  network" action.

### Session layer (the second lock)

- payInvoiceLive refuses when the connected wallet is
  the worker named in the link. A screen bug can no
  longer turn into a self pay.
- The role refusals already there stay as they are.

## Browser storage design

- Before the wallet engine opens, the app probes the
  OPFS entry point (navigator.storage.getDirectory).
- Probe passes: nothing changes. The engine uses its
  normal OPFS stores, as today.
- Probe fails: the engine is given the IndexedDB store
  from the pinned Aztec packages for both its data
  stores instead. Same device, same site storage, same
  data. Nothing leaves the device, and no key handling
  changes. Our own sealed wallet box is untouched.
- Probe fails and the fallback store also fails to open:
  connecting stops with plain words. The words say the
  browser is blocking the storage the wallet needs, to
  leave private browsing or allow site data for this
  site, or to try a current Chrome, Edge, or Firefox
  window, then try again.
- Any wallet error that is a browser storage refusal is
  translated to those same plain words before it can
  reach a screen. Raw browser storage errors never show.
- The Node test path never takes the fallback. It only
  exists where a browser document exists.

## Speed design

- createInvoiceLive learns whether this send is a retry.
  The already-written network check runs only on a
  retry. A first send goes straight to the send. Callers
  pass the truth: the invoice page knows whether the
  bill already held a reserved number, My pay knows
  whether the bill holds one.
- The bill count read stays, once per wallet per
  session, as today.
- The invoice page, the pay page, and wallet connect
  show an elapsed seconds counter while network work
  runs, with words that name the slow part: the device
  is building the private proof, and this is the slow
  step on a public network.
- The invoice page keeps today's safety: the bill and
  its reserved number are saved before the send, so
  leaving mid-write loses nothing. The words say so.

## Security notes

- Role is enforced twice: screens do not draw the wrong
  action, and session calls refuse it. Either layer
  alone failing does not open a cross-role action.
- Self pay is refused in the session layer, keyed on
  the connected wallet address equalling the link's
  worker address. Address compare is exact text after
  the link's own address shape check, as links already
  enforce.
- The storage fallback changes where the wallet engine
  keeps its working data on the same device. It does
  not change what data exists, who can read it (the
  same site origin only), or any key material handling.
  A browser that blocks all storage still cannot run a
  wallet, and now says so in plain words.
- No secrets, keys, or backup codes enter any new log,
  message, or store. Timing words carry seconds only.

## Tests (nasty cases first)

- Pay page with a worker session: own bill screen with
  no pay button; another worker's link shows the
  boundary with no pay button.
- Pay page with a client session whose wallet is the
  link's worker: self pay words, no pay button.
- Session: payInvoiceLive refuses a self pay before any
  chain call.
- Invoice, My pay, Make proof with a client session:
  boundary screen, no form controls.
- Invoice result and My pay: no "Open pay page", Copy
  link present.
- Session: a first send makes no already-written check;
  a retry does, and a retry that finds the bill written
  makes no second send.
- Storage choice: OPFS probe pass picks the normal
  path, probe fail in a browser picks the fallback,
  storage refusals translate to the plain message, and
  the raw words GetDirectory never reach a screen.
- The old fast suite stays green, type check and build
  pass, then the trial copy is checked before the owner
  walks it again. Merge waits for the owner, as always.

## Risks this design creates, and the guards

- The IndexedDB store is marked deprecated in the
  pinned Aztec version. Guard: it is only a fallback
  where OPFS is refused, the pinned version is fixed,
  and the fallback path gets its own tests. Moving off
  it belongs to the next Aztec upgrade, whenever that
  comes.
- Boundary screens add a step when one person plays
  both roles on one device. Guard: the switch button
  keeps the wallet open and reconnects in the other
  role in one press.
- Skipping the already-written check on a first send
  could double-write if a first send somehow repeated.
  Guard: a first send is defined by the bill holding
  no reserved number before it, the number is saved
  before the send runs, and any later send for that
  bill is a retry and does check.
