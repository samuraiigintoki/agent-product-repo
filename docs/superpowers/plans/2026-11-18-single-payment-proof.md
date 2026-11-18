# Single Payment Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB SKILL: Use superpowers:executing-plans
> to implement this plan task by task, on a branch, with the two pass self
> review and the Vercel trial check that the owner asked for. Steps use
> checkbox syntax for tracking.

**Goal:** Build a fake money prototype where a worker makes an invoice,
a client pays it in private on Aztec, and the worker makes a proof that
one single payment was paid in full, which a checker can open and trust.

**Architecture:** A small web app does the screens and the plain rules.
An Aztec contract written in Noir holds the private pay record as a note
owned by the worker and writes only a short public mark for a proof.
Private steps run on the user device. The app never holds user money
and never sees private keys.

**Tech Stack:** TypeScript, React with Vite for the web app, Vitest for
unit tests, Noir and Aztec.nr for the contract, Aztec.js for web to
chain calls, the Aztec local network first and the public test network
second. Versions are pinned only after Task 1 proves what runs today.

**Spec:** docs/superpowers/specs/2026-11-18-private-pay-proof-design.md

## Global Constraints

- Fake money only. Test networks only. No real funds anywhere.
- Working name only: Private Pay Proof. The real name comes after MVP.
- First proof is one single payment, paid in full. No six month proof yet.
- The worker chooses if an amount shows. Hidden is the default.
- Private by default: payer, each exact amount, full history, and the
  worker wallet address stay out of public state and public logs.
- The checker needs no wallet and reads a plain page.
- Work happens in /tmp temp copy, on branches, never on main.
- Each task ends with tests run and a commit. Review passes happen
  before any push, per the owner workflow in AGENTS.md.
- Copy rule: plain simple English in all user facing text.
- The Aztec network is early stage software. Nothing in this plan may
  promise safety for real money.

## Review Focus

- Wrong amount paid: the bill must not show as paid in full.
  Owner: Task 4 contract tests and Task 5 wiring tests.
- Same bill paid twice: the second pay must fail in a clear way.
  Owner: Task 4 contract tests.
- Amount leak: public state, public logs, links, and page sources must
  not carry hidden amounts, payer marks, or wallet addresses.
  Owner: Task 6 leak tests and Task 7 scan.
- Fake or edited proof: a changed claim, a reused proof link, and an
  expired proof must all fail the checker page.
  Owner: Task 6 tests.
- Lost session or wrong wallet: a worker who returns with a different
  wallet must not see another worker records, and must get a clear
  note about recovery limits.
  Owner: Task 5 test and Task 7 tester script.

## File Map

- `apps/web/` web app. Screens, plain rules, wallet calls, checker page.
- `apps/web/src/domain/` pure rules: invoice, pay state, proof claim.
  No chain calls here, so rules can be tested fast and alone.
- `apps/web/src/chain/` Aztec calls only. One file per job: wallet,
  invoice, pay, proof, checker read.
- `apps/web/src/pages/` one file per screen: home, invoice, pay, my pay,
  make proof, check proof.
- `contracts/payment_proof/` Noir contract: invoice note, pay note,
  proof mark. Contract tests live beside it.
- `docs/spikes/` short written results of proof of life checks.
- `docs/testing/` the timed script for the five stranger tests.

---

### Task 1: Toolchain proof of life (spike)

**Files:**
- Create: `docs/spikes/aztec-toolchain.md`
- Create: `TOOLCHAIN.md` at repo root

**Interfaces:**
- Consumes: Aztec official docs, local network guide, token guide.
- Produces: pinned tool and package versions in TOOLCHAIN.md, plus a
  yes or no on three facts: local network runs here, a private token
  move works on it, and a custom note can carry our pay fields.

- [ ] Step 1: Install the Aztec tools by the official guide only.
  Write each tool version into TOOLCHAIN.md as shown by its own
  version command. No version is guessed.
- [ ] Step 2: Run the local network. Check: the network answers and
  the three test accounts can be loaded into a wallet.
- [ ] Step 3: Follow the official token guide to move test tokens
  from public to private, then private to a second account.
  Check: public and private balances match the guide at each step.
- [ ] Step 4: In a throwaway copy of the token guide, add one custom
  note with fields: bill mark, amount, pay date block, payer mark.
  Check: only the owner account can read the note back.
- [ ] Step 5: Write docs/spikes/aztec-toolchain.md with what ran,
  what failed, exact versions, and the time each private step took.
  If a private step cannot run here, stop and report. Do not build
  the product on a guess.
- [ ] Step 6: Commit. Message: docs: prove Aztec toolchain runs

### Task 2: Plain rules core (no chain yet)

**Files:**
- Create: `apps/web/package.json`, Vite and TypeScript setup
- Create: `apps/web/src/domain/invoice.ts`
- Create: `apps/web/src/domain/claim.ts`
- Test: `apps/web/src/domain/invoice.test.ts`
- Test: `apps/web/src/domain/claim.test.ts`

**Interfaces:**
- Produces: `createInvoice(input)` returns an invoice with id, work
  title, amount, client mark, state unpaid.
- Produces: `markPaid(invoice, paidAmount, paidOn)` returns state
  paid in full only when paidAmount equals the invoice amount.
- Produces: `createSinglePaymentClaim(invoice, showAmount, expiresAt)`
  returns claim text, amount shown or null, and expiry.
- Produces: `checkClaim(claim, now)` returns valid, expired, or broken.

- [ ] Step 1: Write invoice tests first. Cases: unpaid at start,
  paid in full at exact amount, not paid at less, not paid at more
  without an explicit overpay flag (there is none in version one).
  Run: `npm test` in apps/web. Expect: fail, files do not exist.
- [ ] Step 2: Write claim tests. Cases: amount hidden gives null,
  amount shown gives the amount, past expiry gives expired, a claim
  with edited amount gives broken.
- [ ] Step 3: Implement the four functions above, smallest code that
  passes. No chain calls, no screens.
- [ ] Step 4: Run: `npm test`. Expect: all pass.
- [ ] Step 5: Commit. Message: feat: add invoice and claim rules

### Task 3: Screens with fake local data

**Files:**
- Create: `apps/web/src/pages/Home.tsx`
- Create: `apps/web/src/pages/Invoice.tsx`
- Create: `apps/web/src/pages/Pay.tsx`
- Create: `apps/web/src/pages/MyPay.tsx`
- Create: `apps/web/src/pages/MakeProof.tsx`
- Create: `apps/web/src/pages/CheckProof.tsx`
- Test: `apps/web/src/pages/flow.test.tsx`

**Interfaces:**
- Consumes: Task 2 functions with in memory fake data behind one
  small store file, `apps/web/src/domain/store.ts`.
- Produces: the full click path a tester can walk with no chain:
  make invoice, open pay link, mark pay, make proof, check proof.

- [ ] Step 1: Write the flow test first: a worker makes an invoice,
  the pay page shows the same bill, a pay action marks it paid, a
  proof is made with amount hidden, the check page shows valid and
  no amount. Run and expect fail.
- [ ] Step 2: Build the six screens with the store. Big plain words,
  three buttons on home: New invoice, My pay, Make proof. The check
  page must read like a document check, not a crypto page.
- [ ] Step 3: Run: `npm test` and `npm run build`. Expect: pass, and
  the build makes a static site with no server secrets.
- [ ] Step 4: Start the site on port 5173 and open each page once.
  Check: no blank page, no error in the browser log.
- [ ] Step 5: Commit. Message: feat: add screens with fake data

### Task 4: Aztec contract for invoice, pay, and receipt note

**Files:**
- Create: `contracts/payment_proof/Nargo.toml`
- Create: `contracts/payment_proof/src/main.nr`
- Test: `contracts/payment_proof/src/test/payment_proof.test.nr`
  (or the test home the pinned Aztec version uses, per TOOLCHAIN.md)

**Interfaces:**
- Produces contract calls used by Task 5, with these app level jobs:
  `create_invoice(bill_id, amount, due mark)` makes an invoice note
  for the worker.
  `pay_invoice(bill_id, amount)` pays in private and makes a receipt
  note for the worker holding bill mark, amount, pay block, payer mark.
  `read_receipts(worker)` in private view returns the worker receipt
  notes and nothing of any other worker.
  Exact Noir shapes follow the pinned version proven in Task 1. If a
  job cannot be done as written, stop, write the limit in the spike
  file, and bring a changed design before coding around it.

- [ ] Step 1: Write contract tests first on the local network:
  invoice made, pay at exact amount gives a receipt note the worker
  can read, pay at wrong amount fails, second pay of same bill
  fails, a third account can read no receipt.
  Run the pinned contract test command. Expect: fail, no contract.
- [ ] Step 2: Implement the smallest contract that passes, using the
  note and private token shapes proven in Task 1.
- [ ] Step 3: Run contract tests. Expect: all pass.
- [ ] Step 4: Run the leak check in test: after a private pay, read
  public state and logs and assert the amount, payer mark, and
  worker address do not appear. Expect: pass.
- [ ] Step 5: Commit. Message: feat: add payment proof contract

### Task 5: Wire screens to the local Aztec network

**Files:**
- Create: `apps/web/src/chain/wallet.ts`
- Create: `apps/web/src/chain/invoiceChain.ts`
- Create: `apps/web/src/chain/payChain.ts`
- Modify: pages from Task 3 to call chain files behind the store
- Test: `apps/web/src/chain/localFlow.test.ts`

**Interfaces:**
- Consumes: Task 4 contract calls, Task 2 rules.
- Produces: one working path on the local network: sign in with a
  test wallet, make an invoice on chain, pay it as a second test
  account, see it in My pay with the receipt read from the chain.

- [ ] Step 1: Write the wiring test first against the local network:
  invoice made in the UI store lands on chain, pay from the client
  account, worker record shows paid in full. Expect: fail.
- [ ] Step 2: Implement wallet sign in with test accounts only.
  A clear note on screen says fake money, test network.
- [ ] Step 3: Implement invoice and pay calls. Time each private
  step and show a calm waiting note while proof is made on device.
- [ ] Step 4: Add the wrong wallet case: sign in as a third account,
  My pay must show nothing and must say why in plain words.
- [ ] Step 5: Run wiring test, unit tests, and build. Expect: pass.
- [ ] Step 6: Commit. Message: feat: wire pay flow to local Aztec

### Task 6: Proof making and the checker page

**Files:**
- Create: `apps/web/src/chain/proofChain.ts`
- Modify: `contracts/payment_proof/src/main.nr` (proof mark job)
- Modify: `apps/web/src/pages/MakeProof.tsx`
- Modify: `apps/web/src/pages/CheckProof.tsx`
- Test: `apps/web/src/chain/proof.test.ts`

**Interfaces:**
- Produces contract job: `mark_proof(claim_hash, expires_at)` writes
  only the hash and expiry in public. The claim words and any amount
  choice stay with the worker and the link they share.
- Produces: MakeProof returns a check link carrying the claim and a
  proof made on the worker device from the receipt note.
- Produces: CheckProof returns valid only when the proof checks out
  against the receipt, the hash on chain matches, and now is before
  expiry. Else it shows expired or not valid, in big plain words.

- [ ] Step 1: Write proof tests first: good proof passes, edited
  amount fails, edited date fails, expired fails, reused link after
  expiry fails, amount hidden claim leaks no amount into the public
  mark read back from chain. Expect: fail.
- [ ] Step 2: Add the contract proof mark job and the device side
  proof in proofChain.ts. Claim hash covers claim words, amount
  choice, bill mark, and expiry.
- [ ] Step 3: Build MakeProof and CheckProof on top. The checker
  page needs no wallet and no sign in.
- [ ] Step 4: Run proof tests, all unit tests, contract tests, build.
  Expect: pass.
- [ ] Step 5: Commit. Message: feat: add single payment proof and checker

### Task 7: Public test network, Vercel trial, and tester pack

**Files:**
- Modify: `apps/web` network settings (local or public test, by a
  single settings file, no secrets in code)
- Create: `docs/testing/five-strangers-script.md`
- Create: `docs/build-in-public/packet-01-toolchain.md` (filled at
  the end, from real results only)
- Modify: `README.md` (how to run, fake money note, limits)

**Interfaces:**
- Consumes: all tasks above.
- Produces: a Vercel trial copy of the web app from the feature
  branch, a timed tester script, and the first build in public packet.

- [ ] Step 1: Point the app at the Aztec public test network with
  test accounts. Run the full path once by hand. Write times in the
  tester script. If the test network cannot carry the path, stay on
  local and write that limit plainly in the README and the packet.
- [ ] Step 2: Push the feature branch. Start the Vercel trial build
  from this chat if it does not start on its own. Wait for done.
- [ ] Step 3: Open the trial copy. Walk the full path like a user:
  invoice, pay, proof, check. Read build notes and screen errors.
  Fix on the same branch and push again until clean.
- [ ] Step 4: Privacy scan: search the built site, public state, and
  logs for hidden amount, payer mark, worker address, and any keys.
  Check: none found. Write the result in the tester script.
- [ ] Step 5: Finish docs/testing/five-strangers-script.md: task for
  five stranger workers, time per step, what to note, the one pay
  question, and thanks. Finish packet 01 from real results only.
- [ ] Step 6: Self review, two passes, then push. Show the owner the
  trial link and the packet. Merge to main only if the owner says yes.

## Self Review (done at plan write time)

Spec coverage: invoice, private pay, private record, single payment
proof, checker link, fake money only, tester hunt, and the public
packet each have a task. Six month proof, team pay, name checks, and
real money are named out of scope in the spec and stay out here.
Interfaces: Task 2 names are used by Task 3 and Task 6 as written.
Task 4 app level jobs are the only chain jobs Task 5 may call. The
one open risk is exact Noir shape, and Task 1 plus the stop rule in
Task 4 own that risk before product code leans on it.
Review Focus lines each name an owner task with tests, above.
